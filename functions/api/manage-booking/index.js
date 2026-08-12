import {
  resolveManageToken,
  getAppointmentPaymentSummary,
  getAppointmentForms
} from "../../../lib/self-service.js";

import {
  getAvailableSlots,
  addMinutesToDateTime,
  validDate,
  validTime
} from "../../../lib/public-booking.js";

import {
  sendAppointmentCommunication
} from "../../../lib/communications.js";

function badRequest(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 400 }
  );
}

function notFound() {
  return Response.json(
    {
      ok: false,
      error: "This manage-booking link is invalid or has expired."
    },
    { status: 404 }
  );
}

function conflict(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 409 }
  );
}

function bookingData(row) {
  return {
    id: row.appointment_id,
    status: row.status,
    service_id: row.service_id,
    service_name: row.service_name,
    booking_kind: row.booking_kind || "service",
    booking_label:
      row.booking_kind === "consultation"
        ? `Consultation · ${row.service_name}`
        : row.service_name,
    start_at: row.start_at,
    end_at: row.end_at,
    duration_minutes: Number(row.duration_minutes || 0),
    price_minor: Number(row.price_minor || 0),
    deposit_due_minor: Number(row.deposit_due_minor || 0),
    requires_consultation: Number(row.requires_consultation || 0),
    requires_patch_test: Number(row.requires_patch_test || 0),
    cancellation_reason: row.cancellation_reason || null
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const token = String(url.searchParams.get("token") || "").trim();

    const row = await resolveManageToken({ env, token });

    if (!row) {
      return notFound();
    }

    const [payment, forms] = await Promise.all([
      getAppointmentPaymentSummary({
        env,
        businessId: row.business_id,
        appointmentId: row.appointment_id
      }),
      getAppointmentForms({
        env,
        businessId: row.business_id,
        appointmentId: row.appointment_id
      })
    ]);

    const outstandingMinor = Math.max(
      Number(row.price_minor || 0) -
        Number(payment.net_paid_minor || 0) -
        Number(payment.consultation_credit_minor || 0),
      0
    );

    return Response.json({
      ok: true,

      customer: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email
      },

      business: {
        name: row.business_name,
        timezone: row.timezone || "Europe/London",
        currency: row.currency || "GBP",
        locale: row.locale || "en-GB",
        branding: {
          logo_data_url: row.logo_data_url || null,
          primary_colour: row.primary_colour || "#365c50",
          background_colour: row.background_colour || "#f5f4ef",
          surface_colour: row.surface_colour || "#ffffff",
          text_colour: row.text_colour || "#18221f"
        }
      },

      booking: bookingData(row),

      payment: {
        ...payment,
        outstanding_minor: outstandingMinor
      },

      forms,

      permissions: {
        can_reschedule: row.status === "confirmed",
        can_cancel: row.status === "confirmed"
      }
    });
  } catch (error) {
    console.error("Manage booking GET failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load this booking." },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const action = String(body.action || "").trim().toLowerCase();

    const row = await resolveManageToken({ env, token });

    if (!row) {
      return notFound();
    }

    if (action === "cancel") {
      if (row.status === "cancelled") {
        return Response.json({ ok: true, cancelled: true });
      }

      if (row.status !== "confirmed") {
        return conflict("This appointment can no longer be cancelled online.");
      }

      const reason = String(
        body.reason || "Cancelled by customer through self-service"
      )
        .trim()
        .slice(0, 500);

      await env.DB
        .prepare(`
          UPDATE appointments
          SET
            status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
            AND status = 'confirmed'
        `)
        .bind(
          reason || "Cancelled by customer through self-service",
          row.appointment_id,
          row.business_id
        )
        .run();

      await sendAppointmentCommunication({
        env,
        businessId: row.business_id,
        appointmentId: row.appointment_id,
        type: "cancellation_confirmation",
        uniqueKey:
          `cancellation_confirmation:self_service:${row.appointment_id}:${Date.now()}`,
        baseUrl: new URL(request.url).origin
      });

      return Response.json({
        ok: true,
        cancelled: true
      });
    }

    if (action === "reschedule") {
      if (row.status !== "confirmed") {
        return conflict("This appointment can no longer be rescheduled online.");
      }

      const date = String(body.date || "").trim();
      const time = String(body.time || "").trim();

      if (!validDate(date) || !validTime(time)) {
        return badRequest("Choose a valid date and time.");
      }

      const businessRow = await env.DB
        .prepare(`
          SELECT
            booking_buffer_before_minutes,
            booking_buffer_after_minutes
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `)
        .bind(row.business_id)
        .first();

      const availability = await getAvailableSlots({
        env,
        business: {
          id: row.business_id,
          timezone: row.timezone || "Europe/London",
          booking_buffer_before_minutes:
            Number(businessRow?.booking_buffer_before_minutes || 0),
          booking_buffer_after_minutes:
            Number(businessRow?.booking_buffer_after_minutes || 0)
        },
        service: {
          id: row.service_id,
          duration_minutes: Number(row.duration_minutes || 0)
        },
        date,
        excludeAppointmentId: row.appointment_id
      });

      if (availability.error) {
        return badRequest(availability.error);
      }

      if (!(availability.slots || []).includes(time)) {
        return conflict(
          availability.reason ||
            "That time is no longer available. Please choose another time."
        );
      }

      const startAt = `${date}T${time}:00`;
      const endAt = addMinutesToDateTime(
        date,
        time,
        Number(row.duration_minutes || 0)
      );

      await env.DB
        .prepare(`
          UPDATE appointments
          SET
            start_at = ?,
            end_at = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
            AND status = 'confirmed'
        `)
        .bind(
          startAt,
          endAt,
          row.appointment_id,
          row.business_id
        )
        .run();

      await sendAppointmentCommunication({
        env,
        businessId: row.business_id,
        appointmentId: row.appointment_id,
        type: "reschedule_confirmation",
        uniqueKey:
          `reschedule_confirmation:self_service:${row.appointment_id}:${startAt}`,
        baseUrl: new URL(request.url).origin
      });

      return Response.json({
        ok: true,
        rescheduled: true,
        booking: {
          ...bookingData(row),
          start_at: startAt,
          end_at: endAt
        }
      });
    }

    return badRequest("Invalid manage-booking action.");
  } catch (error) {
    console.error("Manage booking POST failed:", error);

    return Response.json(
      { ok: false, error: "Unable to update this booking." },
      { status: 500 }
    );
  }
}
