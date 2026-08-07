import {
  readSessionToken,
  hashSessionToken
} from "../../lib/auth.js";


export async function onRequestGet({
  request,
  env
}) {

  try {

    const sessionToken =
      readSessionToken(request);


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
            b.currency

          FROM user_sessions s

          JOIN users u
            ON u.id = s.user_id

          JOIN businesses b
            ON b.id = u.business_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(s.expires_at)
                > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `)
        .bind(tokenHash)
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


    const todayBookings =
      await env.DB
        .prepare(`
          SELECT COUNT(*) AS count

          FROM appointments

          WHERE
            business_id = ?
            AND status != 'cancelled'
            AND date(start_at)
                = date('now')
        `)
        .bind(session.business_id)
        .first();


    const upcomingBookings =
      await env.DB
        .prepare(`
          SELECT COUNT(*) AS count

          FROM appointments

          WHERE
            business_id = ?
            AND status IN (
              'pending',
              'confirmed'
            )
            AND datetime(start_at)
                > datetime('now')
        `)
        .bind(session.business_id)
        .first();


    const customers =
      await env.DB
        .prepare(`
          SELECT COUNT(*) AS count

          FROM customers

          WHERE business_id = ?
        `)
        .bind(session.business_id)
        .first();


    const revenue =
      await env.DB
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
        `)
        .bind(session.business_id)
        .first();


    const appointments =
      await env.DB
        .prepare(`
          SELECT
            a.id,
            a.start_at,
            a.end_at,
            a.status,

            c.first_name,
            c.last_name,

            s.name AS service_name

          FROM appointments a

          JOIN customers c
            ON c.id = a.customer_id

          JOIN services s
            ON s.id = a.service_id

          WHERE
            a.business_id = ?
            AND a.status IN (
              'pending',
              'confirmed'
            )
            AND datetime(a.start_at)
                >= datetime('now')

          ORDER BY
            datetime(a.start_at) ASC

          LIMIT 5
        `)
        .bind(session.business_id)
        .all();


    return Response.json(
      {
        ok: true,

        user: {
          id: session.user_id,
          name: session.user_name,
          email: session.email
        },

        business: {
          id: session.business_id,
          name: session.business_name,
          currency: session.currency
        },

        stats: {
          today_bookings:
            Number(
              todayBookings?.count || 0
            ),

          upcoming_bookings:
            Number(
              upcomingBookings?.count || 0
            ),

          customers:
            Number(
              customers?.count || 0
            ),

          revenue_minor:
            Number(
              revenue?.total || 0
            )
        },

        appointments:
          appointments.results || []
      },
      {
        headers: {
          "Cache-Control": "no-store"
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
