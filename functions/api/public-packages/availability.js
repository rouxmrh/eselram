import {
  getPublicBusiness,
  getAvailableSlots,
  cleanupPendingOnlineBookings,
  validDate,
  badRequest,
  serverError
} from "../../../lib/public-booking.js";


export async function onRequestGet({
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

    const url =
      new URL(
        request.url
      );

    const saleId =
      String(
        url.searchParams.get(
          "sale_id"
        ) ||
        ""
      ).trim();

    const date =
      String(
        url.searchParams.get(
          "date"
        ) ||
        ""
      ).trim();

    if (
      !saleId ||
      !validDate(
        date
      )
    ) {
      return badRequest(
        "A valid package purchase and date are required."
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

    if (
      Number(
        row.requires_consultation ||
        0
      ) === 1
    ) {
      const completedConsultation =
        await env.DB
          .prepare(`
            SELECT id
            FROM appointments
            WHERE
              business_id = ?
              AND customer_id = ?
              AND service_id = ?
              AND booking_kind =
                  'consultation'
              AND status =
                  'completed'
            LIMIT 1
          `)
          .bind(
            business.id,
            row.customer_id,
            row.service_id
          )
          .first();

      if (!completedConsultation) {
        return Response.json(
          {
            ok: false,
            error:
              "The consultation must be completed before a package session can be booked.",
            consultation_required:
              true
          },
          {
            status: 409
          }
        );
      }
    }

    const availability =
      await getAvailableSlots({
        env,
        business,
        service:
          row,
        date
      });

    if (availability.error) {
      return badRequest(
        availability.error
      );
    }

    return Response.json({
      ok: true,
      date,
      timezone:
        business.timezone,
      service: {
        id:
          row.service_id,
        name:
          row.service_name,
        duration_minutes:
          Number(
            row.duration_minutes ||
            0
          )
      },
      slots:
        availability.slots ||
        [],
      reason:
        availability.reason ||
        null
    });
  } catch (error) {
    console.error(
      "Public package availability failed:",
      error
    );

    return serverError(
      "Unable to load package-session availability."
    );
  }
}
