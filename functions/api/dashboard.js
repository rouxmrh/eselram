import {
  readSessionToken,
  hashSessionToken
} from "../../lib/auth.js";

import {
  cleanupPendingOnlineBookings
} from "../../lib/public-booking.js";


export async function onRequestGet({
  request,
  env
}) {

  try {

    const sessionToken =
      readSessionToken(
        request
      );


    if (!sessionToken) {

      return Response.json(
        {
          ok: false,
          authenticated: false
        },
        {
          status: 401
        }
      );
    }


    const tokenHash =
      await hashSessionToken(
        sessionToken
      );


    const session =
      await env.DB
        .prepare(`
          SELECT
            u.id AS user_id,
            u.name AS user_name,
            u.email,
            u.business_id,

            b.name AS business_name,
            b.currency,
            b.timezone

          FROM user_sessions s

          JOIN users u
            ON u.id =
               s.user_id

          JOIN businesses b
            ON b.id =
               u.business_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `)
        .bind(
          tokenHash
        )
        .first();


    if (!session) {

      return Response.json(
        {
          ok: false,
          authenticated: false
        },
        {
          status: 401
        }
      );
    }

    await cleanupPendingOnlineBookings(env, session.business_id);


    const [
      todayBookings,
      weekBookings,
      customers,
      newCustomersMonth,
      monthRevenue,
      outstanding,
      todaySchedule,
      upcomingAppointments,
      activity
    ] =
      await Promise.all([

        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM appointments

            WHERE
              business_id = ?
              AND status != 'cancelled'
              AND NOT (booking_source = 'online' AND status = 'pending')
              AND date(start_at)
                  = date('now')
          `)
          .bind(
            session.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM appointments

            WHERE
              business_id = ?
              AND status IN (
                'pending',
                'confirmed'
              )
              AND NOT (booking_source = 'online' AND status = 'pending')
              AND datetime(start_at)
                  >= datetime('now')
              AND datetime(start_at)
                  < datetime(
                    'now',
                    '+7 days'
                  )
          `)
          .bind(
            session.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM customers c

            WHERE
              c.business_id = ?
              AND NOT (
                EXISTS (
                  SELECT 1
                  FROM appointments ap
                  WHERE
                    ap.customer_id = c.id
                    AND ap.business_id = c.business_id
                    AND ap.booking_source = 'online'
                    AND ap.status IN ('pending', 'cancelled')
                    AND ABS((julianday(ap.created_at) - julianday(c.created_at)) * 86400) <= 120
                    AND NOT EXISTS (
                      SELECT 1
                      FROM payments pp
                      WHERE
                        pp.appointment_id = ap.id
                        AND pp.business_id = ap.business_id
                        AND pp.status IN ('paid', 'partially_refunded', 'refunded')
                        AND pp.payment_type != 'refund'
                    )
                    AND (
                      ap.status = 'pending'
                      OR ap.cancellation_reason IN (
                        'Online booking payment was not completed',
                        'Customer left online payment before completion',
                        'Online payment could not be started',
                        'Online booking could not be completed'
                      )
                      OR EXISTS (
                        SELECT 1
                        FROM payments ps
                        WHERE
                          ps.appointment_id = ap.id
                          AND ps.business_id = ap.business_id
                          AND ps.provider = 'stripe'
                          AND ps.status IN ('pending', 'failed')
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM appointments ar
                  WHERE
                    ar.customer_id = c.id
                    AND ar.business_id = c.business_id
                    AND (
                      ar.booking_source != 'online'
                      OR ar.status NOT IN ('pending', 'cancelled')
                      OR EXISTS (
                        SELECT 1
                        FROM payments pr
                        WHERE
                          pr.appointment_id = ar.id
                          AND pr.business_id = ar.business_id
                          AND pr.status IN ('paid', 'partially_refunded', 'refunded')
                          AND pr.payment_type != 'refund'
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM payments pc
                  WHERE
                    pc.customer_id = c.id
                    AND pc.business_id = c.business_id
                    AND pc.status IN ('paid', 'partially_refunded', 'refunded')
                    AND pc.payment_type != 'refund'
                )
              )
          `)
          .bind(
            session.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM customers c

            WHERE
              c.business_id = ?
              AND NOT (
                EXISTS (
                  SELECT 1
                  FROM appointments ap
                  WHERE
                    ap.customer_id = c.id
                    AND ap.business_id = c.business_id
                    AND ap.booking_source = 'online'
                    AND ap.status IN ('pending', 'cancelled')
                    AND ABS((julianday(ap.created_at) - julianday(c.created_at)) * 86400) <= 120
                    AND NOT EXISTS (
                      SELECT 1
                      FROM payments pp
                      WHERE
                        pp.appointment_id = ap.id
                        AND pp.business_id = ap.business_id
                        AND pp.status IN ('paid', 'partially_refunded', 'refunded')
                        AND pp.payment_type != 'refund'
                    )
                    AND (
                      ap.status = 'pending'
                      OR ap.cancellation_reason IN (
                        'Online booking payment was not completed',
                        'Customer left online payment before completion',
                        'Online payment could not be started',
                        'Online booking could not be completed'
                      )
                      OR EXISTS (
                        SELECT 1
                        FROM payments ps
                        WHERE
                          ps.appointment_id = ap.id
                          AND ps.business_id = ap.business_id
                          AND ps.provider = 'stripe'
                          AND ps.status IN ('pending', 'failed')
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM appointments ar
                  WHERE
                    ar.customer_id = c.id
                    AND ar.business_id = c.business_id
                    AND (
                      ar.booking_source != 'online'
                      OR ar.status NOT IN ('pending', 'cancelled')
                      OR EXISTS (
                        SELECT 1
                        FROM payments pr
                        WHERE
                          pr.appointment_id = ar.id
                          AND pr.business_id = ar.business_id
                          AND pr.status IN ('paid', 'partially_refunded', 'refunded')
                          AND pr.payment_type != 'refund'
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM payments pc
                  WHERE
                    pc.customer_id = c.id
                    AND pc.business_id = c.business_id
                    AND pc.status IN ('paid', 'partially_refunded', 'refunded')
                    AND pc.payment_type != 'refund'
                )
              )
              AND strftime(
                '%Y-%m',
                c.created_at
              ) = strftime(
                '%Y-%m',
                'now'
              )
          `)
          .bind(
            session.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COALESCE(
                SUM(amount_minor),
                0
              ) AS total

            FROM payments

            WHERE
              business_id = ?
              AND status = 'paid'
              AND payment_type != 'refund'
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) = strftime(
                '%Y-%m',
                'now'
              )
          `)
          .bind(
            session.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN
                      a.price_minor -
                      COALESCE(
                        (
                          SELECT
                            SUM(
                              CASE
                                WHEN
                                  p.payment_type = 'refund'
                                THEN -p.amount_minor
                                ELSE p.amount_minor
                              END
                            )

                          FROM payments p

                          WHERE
                            p.appointment_id =
                              a.id
                            AND p.business_id =
                              a.business_id
                            AND p.status =
                              'paid'
                        ),
                        0
                      ) > 0
                    THEN
                      a.price_minor -
                      COALESCE(
                        (
                          SELECT
                            SUM(
                              CASE
                                WHEN
                                  p.payment_type = 'refund'
                                THEN -p.amount_minor
                                ELSE p.amount_minor
                              END
                            )

                          FROM payments p

                          WHERE
                            p.appointment_id =
                              a.id
                            AND p.business_id =
                              a.business_id
                            AND p.status =
                              'paid'
                        ),
                        0
                      )
                    ELSE 0
                  END
                ),
                0
              ) AS total

            FROM appointments a

            WHERE
              a.business_id = ?
              AND a.status != 'cancelled'
              AND NOT (a.booking_source = 'online' AND a.status = 'pending')
          `)
          .bind(
            session.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              a.id,
              a.start_at,
              a.end_at,
              a.status,
              a.price_minor,

              c.id AS customer_id,
              c.first_name,
              c.last_name,

              s.id AS service_id,
              CASE
                WHEN a.booking_kind = 'consultation'
                  THEN 'Consultation · ' || s.name
                ELSE s.name
              END AS service_name

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status !=
                  'cancelled'
              AND NOT (a.booking_source = 'online' AND a.status = 'pending')
              AND date(a.start_at)
                  = date('now')

            ORDER BY
              datetime(
                a.start_at
              ) ASC
          `)
          .bind(
            session.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              a.id,
              a.start_at,
              a.end_at,
              a.status,
              a.price_minor,

              c.id AS customer_id,
              c.first_name,
              c.last_name,

              s.id AS service_id,
              CASE
                WHEN a.booking_kind = 'consultation'
                  THEN 'Consultation · ' || s.name
                ELSE s.name
              END AS service_name

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status IN (
                'pending',
                'confirmed'
              )
              AND NOT (a.booking_source = 'online' AND a.status = 'pending')
              AND datetime(
                a.start_at
              ) >= datetime('now')

            ORDER BY
              datetime(
                a.start_at
              ) ASC

            LIMIT 6
          `)
          .bind(
            session.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              title,
              detail,
              occurred_at

            FROM (

              SELECT
                'Booking created' AS title,

                c.first_name ||
                ' ' ||
                c.last_name ||
                ' · ' ||
                CASE
                  WHEN a.booking_kind = 'consultation'
                    THEN 'Consultation · ' || s.name
                  ELSE s.name
                END AS detail,

                a.created_at AS occurred_at

              FROM appointments a

              JOIN customers c
                ON c.id =
                   a.customer_id

              JOIN services s
                ON s.id =
                   a.service_id

              WHERE
                a.business_id = ?
                AND NOT (a.booking_source = 'online' AND a.status = 'pending')


              UNION ALL


              SELECT
                'Customer added' AS title,

                c.first_name ||
                ' ' ||
                c.last_name AS detail,

                c.created_at AS occurred_at

              FROM customers c

              WHERE
                c.business_id = ?


              UNION ALL


              SELECT
                'Payment received' AS title,

                COALESCE(
                  c.first_name ||
                  ' ' ||
                  c.last_name,
                  'Customer'
                ) ||
                ' · ' ||
                printf(
                  '%.2f',
                  p.amount_minor /
                  100.0
                ) AS detail,

                COALESCE(
                  p.paid_at,
                  p.created_at
                ) AS occurred_at

              FROM payments p

              LEFT JOIN customers c
                ON c.id =
                   p.customer_id

              WHERE
                p.business_id = ?
                AND p.status =
                    'paid'
                AND p.payment_type !=
                    'refund'

            )

            ORDER BY
              datetime(
                occurred_at
              ) DESC

            LIMIT 8
          `)
          .bind(
            session.business_id,
            session.business_id,
            session.business_id
          )
          .all()
      ]);


    return Response.json(
      {
        ok: true,

        user: {
          id:
            session.user_id,
          name:
            session.user_name,
          email:
            session.email
        },

        business: {
          id:
            session.business_id,
          name:
            session.business_name,
          currency:
            session.currency ||
            "GBP",
          timezone:
            session.timezone ||
            "Europe/London"
        },

        stats: {
          today_bookings:
            Number(
              todayBookings
                ?.count ||
              0
            ),

          week_bookings:
            Number(
              weekBookings
                ?.count ||
              0
            ),

          customers:
            Number(
              customers
                ?.count ||
              0
            ),

          new_customers_month:
            Number(
              newCustomersMonth
                ?.count ||
              0
            ),

          month_revenue_minor:
            Number(
              monthRevenue
                ?.total ||
              0
            ),

          outstanding_minor:
            Number(
              outstanding
                ?.total ||
              0
            )
        },

        today_schedule:
          todaySchedule.results ||
          [],

        upcoming_appointments:
          upcomingAppointments.results ||
          [],

        recent_activity:
          activity.results ||
          []
      },
      {
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (error) {

    console.error(
      "Dashboard API failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load dashboard."
      },
      {
        status: 500
      }
    );
  }
}
