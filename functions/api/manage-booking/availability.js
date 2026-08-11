import {
  resolveManageToken
} from "../../../lib/self-service.js";

import {
  getAvailableSlots,
  validDate
} from "../../../lib/public-booking.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const token = String(url.searchParams.get("token") || "").trim();
    const date = String(url.searchParams.get("date") || "").trim();

    if (!validDate(date)) {
      return Response.json(
        { ok: false, error: "Choose a valid date." },
        { status: 400 }
      );
    }

    const row = await resolveManageToken({ env, token });

    if (!row) {
      return Response.json(
        {
          ok: false,
          error: "This manage-booking link is invalid or has expired."
        },
        { status: 404 }
      );
    }

    if (row.status !== "confirmed") {
      return Response.json({
        ok: true,
        slots: [],
        reason: "This appointment can no longer be rescheduled online."
      });
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
      return Response.json(
        { ok: false, error: availability.error },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      slots: availability.slots || [],
      reason: availability.reason || null
    });
  } catch (error) {
    console.error("Manage booking availability failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load available times." },
      { status: 500 }
    );
  }
}
