import {
  getPublicBusiness,
  getAvailableSlots,
  cleanupPendingOnlineBookings,
  addMinutesToDateTime,
  validDate,
  validTime,
  badRequest,
  conflict,
  serverError
} from "../../../lib/public-booking.js";

import {
  sendAppointmentCommunication
} from "../../../lib/communications.js";

import {
  runServiceFormAutomation
} from "../../../lib/form-automation.js";

import {
  hasCompletedConsultation
} from "../../../lib/consultation-credit.js";


export async function onRequestPost({
  request,
  env
}) {
  try {
    const business =
      await getPublicBusiness(
        env
      );

    if (!business) {
      return Response.json(
        {
          ok: false,
          error:
            "Business is unavailable."
        },
        {
          status: 404
        }
      );
    }

    const body =
      await request.json();

    const saleId =
      String(
        body.sale_id ||
        ""
      ).trim();

    const date =
      String(
        body.date ||
        ""
      ).trim();

    const time =
      String(
        body.time ||
        ""
      ).trim();

    if (
      !saleId ||
      !validDate(
        date
      ) ||
      !validTime(
        time
      )
    ) {
      return badRequest(
        "A valid package purchase, date and time are required."
      );
    }

    await cleanupPendingOnlineBookings(
      env,
      business.id
    );

    const row =
      await env.DB
        .prepare(`
          SELECT
            ps.customer_id,
            ps.customer_package_id,
            cp.status AS package_status,
            cp.sessions_total,
            cp.expires_on,
            pt.service_id,
            s.name AS service_name,
            s.duration_minutes,
            s.price_minor,
            s.deposit_minor,
            s.payment_timing,
            s.requires_consultation,
            s.requires_patch_test,
            s.is_active

          FROM package_sales ps

          JOIN package_templates pt
            ON pt.id =
               ps.package_template_id

          JOIN services s
            ON s.id =
               pt.service_id
           AND s.business_id =
               ps.business_id

          JOIN customer_packages cp
            ON cp.id =
               ps.customer_package_id

          WHERE
            ps.id = ?
            AND ps.business_id = ?
            AND ps.source =
                'public'
            AND ps.status =
                'paid'

          LIMIT 1
        `)
        .bind(
          saleId,
          business.id
        )
        .first();

    if (
      !row ||
      !row.customer_package_id
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The paid package could not be found."
        },
        {
          status: 404
        }
      );
    }

    if (
      row.package_status !==
        "active"
    ) {
      return badRequest(
        "This package is not available for booking."
      );
    }

    if (
      row.expires_on &&
      date >
        row.expires_on
    ) {
      return badRequest(
        "The selected date is after this package expires."
      );
    }

    if (
      Number(
        row.requires_consultation ||
        0
      ) === 1
    ) {
      const completedConsultation =
        await hasCompletedConsultation({
          env,
          businessId: business.id,
          customerId: row.customer_id,
          serviceId: row.service_id
        });

      if (!completedConsultation) {
        return Response.json(
          {
            ok: false,
            error:
              "The consultation must be completed before a package session can be booked."
          },
          {
            status: 409
          }
        );
      }
    }

    const committed =
      await env.DB
        .prepare(`
          SELECT COUNT(*) AS count
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id =
               cpa.appointment_id
          WHERE
            cpa.customer_package_id = ?
            AND a.status IN (
              'pending',
              'confirmed',
              'completed'
            )
        `)
        .bind(
          row.customer_package_id
        )
        .first();

    if (
      Number(
        committed?.count ||
        0
      ) >=
      Number(
        row.sessions_total ||
        0
      )
    ) {
      return badRequest(
        "There are no package sessions remaining to book."
      );
    }

    const availability =
      await getAvailableSlots({
        env,
        business,
        service:
          row,
        date
      });

    if (
      availability.error
    ) {
      return badRequest(
        availability.error
      );
    }

    if (
      !(availability.slots || [])
        .includes(
          time
        )
    ) {
      return conflict(
        availability.reason ||
        "That time is no longer available."
      );
    }

    const appointmentId =
      `apt_${crypto.randomUUID()}`;

    const startAt =
      `${date}T${time}:00`;

    const endAt =
      addMinutesToDateTime(
        date,
        time,
        Number(
          row.duration_minutes ||
          0
        )
      );

    const insert =
      await env.DB
        .prepare(`
          INSERT INTO appointments (
            id,
            business_id,
            customer_id,
            service_id,
            status,
            start_at,
            end_at,
            price_minor,
            deposit_due_minor,
            booking_source,
            booking_kind
          )
          SELECT
            ?, ?, ?, ?,
            'confirmed',
            ?, ?,
            0,
            0,
            'online',
            'service'
          WHERE NOT EXISTS (
            SELECT 1
            FROM appointments existing
            WHERE
              existing.business_id = ?
              AND existing.status !=
                  'cancelled'
              AND datetime(
                existing.start_at
              ) < datetime(?)
              AND datetime(
                existing.end_at
              ) > datetime(?)
          )
        `)
        .bind(
          appointmentId,
          business.id,
          row.customer_id,
          row.service_id,
          startAt,
          endAt,
          business.id,
          endAt,
          startAt
        )
        .run();

    if (
      !insert.meta?.changes
    ) {
      return conflict(
        "That time has just been booked. Please choose another time."
      );
    }

    await env.DB
      .prepare(`
        INSERT INTO customer_package_appointments (
          customer_package_id,
          appointment_id
        )
        VALUES (?, ?)
      `)
      .bind(
        row.customer_package_id,
        appointmentId
      )
      .run();

    try {
      await sendAppointmentCommunication({
        env,
        businessId:
          business.id,
        appointmentId,
        type:
          "booking_confirmation",
        uniqueKey:
          `booking_confirmation:${appointmentId}`,
        baseUrl:
          new URL(
            request.url
          ).origin
      });
    } catch (error) {
      console.error(
        "Public package-session confirmation failed:",
        error
      );
    }

    try {
      await runServiceFormAutomation({
        env,
        businessId:
          business.id,
        appointmentId,
        triggerEvent:
          "booking_confirmed",
        baseUrl:
          new URL(
            request.url
          ).origin
      });
    } catch (error) {
      console.error(
        "Public package-session form automation failed:",
        error
      );
    }

    return Response.json({
      ok: true,
      booking: {
        id:
          appointmentId,
        service_name:
          row.service_name,
        start_at:
          startAt,
        end_at:
          endAt,
        status:
          "confirmed",
        price_minor:
          0,
        covered_by_package:
          true,
        customer_package_id:
          row.customer_package_id
      }
    });
  } catch (error) {
    console.error(
      "Public package-session booking failed:",
      error
    );

    return serverError(
      "Unable to book the package session."
    );
  }
}
