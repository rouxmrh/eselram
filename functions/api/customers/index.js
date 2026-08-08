import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";


async function getUserContext(
  request,
  env
) {

  const token =
    readSessionToken(request);


  if (!token) {
    return null;
  }


  const tokenHash =
    await hashSessionToken(
      token
    );


  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(
      tokenHash
    )
    .first();
}


function unauthorized() {

  return Response.json(
    {
      ok: false,
      error:
        "Authentication required."
    },
    {
      status: 401
    }
  );
}


function badRequest(
  message
) {

  return Response.json(
    {
      ok: false,
      error:
        message
    },
    {
      status: 400
    }
  );
}


function notFound(
  message
) {

  return Response.json(
    {
      ok: false,
      error:
        message
    },
    {
      status: 404
    }
  );
}


/* =======================================================
   GET list / detail
   ======================================================= */

export async function onRequestGet({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const url =
      new URL(
        request.url
      );


    const id =
      String(
        url.searchParams.get(
          "id"
        ) ||
        ""
      ).trim();


    if (id) {

      const customer =
        await env.DB
          .prepare(`
            SELECT
              c.id,
              c.first_name,
              c.last_name,
              c.email,
              c.phone,
              c.notes,
              c.marketing_consent,
              c.created_at,
              c.updated_at,

              (
                SELECT COUNT(*)

                FROM appointments a

                WHERE
                  a.customer_id = c.id
                  AND a.business_id = c.business_id
                  AND a.status = 'completed'
              ) AS visit_count,

              (
                SELECT COUNT(*)

                FROM appointments a

                WHERE
                  a.customer_id = c.id
                  AND a.business_id = c.business_id
                  AND a.status != 'cancelled'
                  AND datetime(a.start_at)
                      >= datetime('now')
              ) AS upcoming_count,

              (
                SELECT COALESCE(
                  SUM(p.amount_minor),
                  0
                )

                FROM payments p

                WHERE
                  p.customer_id = c.id
                  AND p.business_id = c.business_id
                  AND p.status = 'paid'
                  AND p.payment_type != 'refund'
              ) AS total_paid_minor

            FROM customers c

            WHERE
              c.id = ?
              AND c.business_id = ?

            LIMIT 1
          `)
          .bind(
            id,
            user.business_id
          )
          .first();


      if (!customer) {

        return notFound(
          "Customer not found."
        );
      }


      const upcoming =
        await env.DB
          .prepare(`
            SELECT
              a.id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,
              s.id AS service_id,
              s.name AS service_name

            FROM appointments a

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.customer_id = ?
              AND a.business_id = ?
              AND a.status != 'cancelled'
              AND datetime(a.start_at)
                  >= datetime('now')

            ORDER BY
              datetime(a.start_at) ASC

            LIMIT 20
          `)
          .bind(
            id,
            user.business_id
          )
          .all();


      const history =
        await env.DB
          .prepare(`
            SELECT
              a.id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,
              s.id AS service_id,
              s.name AS service_name

            FROM appointments a

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.customer_id = ?
              AND a.business_id = ?
              AND (
                datetime(a.start_at)
                    < datetime('now')
                OR a.status IN (
                  'completed',
                  'cancelled',
                  'no_show'
                )
              )

            ORDER BY
              datetime(a.start_at) DESC

            LIMIT 50
          `)
          .bind(
            id,
            user.business_id
          )
          .all();


      return Response.json({
        ok: true,

        customer: {
          ...customer,

          upcoming_bookings:
            upcoming.results ||
            [],

          booking_history:
            history.results ||
            []
        }
      });
    }


    const customers =
      await env.DB
        .prepare(`
          SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.notes,
            c.marketing_consent,
            c.created_at,
            c.updated_at,

            (
              SELECT COUNT(*)

              FROM appointments a

              WHERE
                a.customer_id = c.id
                AND a.business_id = c.business_id
                AND a.status = 'completed'
            ) AS visit_count,

            (
              SELECT COALESCE(
                SUM(p.amount_minor),
                0
              )

              FROM payments p

              WHERE
                p.customer_id = c.id
                AND p.business_id = c.business_id
                AND p.status = 'paid'
                AND p.payment_type != 'refund'
            ) AS total_paid_minor

          FROM customers c

          WHERE
            c.business_id = ?

          ORDER BY
            c.last_name COLLATE NOCASE,
            c.first_name COLLATE NOCASE
        `)
        .bind(
          user.business_id
        )
        .all();


    return Response.json({
      ok: true,

      customers:
        customers.results ||
        []
    });


  } catch (error) {

    console.error(
      "Customers GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load customers."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   POST customer
   ======================================================= */

export async function onRequestPost({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const body =
      await request.json();


    const firstName =
      String(
        body.first_name ||
        ""
      ).trim();

    const lastName =
      String(
        body.last_name ||
        ""
      ).trim();

    const email =
      String(
        body.email ||
        ""
      ).trim();

    const phone =
      String(
        body.phone ||
        ""
      ).trim();

    const notes =
      String(
        body.notes ||
        ""
      ).trim();

    const marketingConsent =
      body.marketing_consent === 1
        ? 1
        : 0;


    if (
      !firstName ||
      !lastName
    ) {

      return badRequest(
        "First and last name are required."
      );
    }


    if (email) {

      const duplicate =
        await env.DB
          .prepare(`
            SELECT id

            FROM customers

            WHERE
              business_id = ?
              AND lower(email) =
                  lower(?)

            LIMIT 1
          `)
          .bind(
            user.business_id,
            email
          )
          .first();


      if (duplicate) {

        return Response.json(
          {
            ok: false,
            error:
              "A customer with this email address already exists.",
            customer_id:
              duplicate.id
          },
          {
            status: 409
          }
        );
      }
    }


    const id =
      `cus_${
        crypto.randomUUID()
      }`;


    await env.DB
      .prepare(`
        INSERT INTO customers (
          id,
          business_id,
          first_name,
          last_name,
          email,
          phone,
          notes,
          marketing_consent
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        id,
        user.business_id,
        firstName,
        lastName,
        email || null,
        phone || null,
        notes || null,
        marketingConsent
      )
      .run();


    return Response.json({
      ok: true,
      customer: {
        id
      }
    });


  } catch (error) {

    console.error(
      "Customer creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to create customer."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   PUT customer
   ======================================================= */

export async function onRequestPut({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const body =
      await request.json();


    const id =
      String(
        body.id ||
        ""
      ).trim();

    const firstName =
      String(
        body.first_name ||
        ""
      ).trim();

    const lastName =
      String(
        body.last_name ||
        ""
      ).trim();

    const email =
      String(
        body.email ||
        ""
      ).trim();

    const phone =
      String(
        body.phone ||
        ""
      ).trim();

    const notes =
      String(
        body.notes ||
        ""
      ).trim();

    const marketingConsent =
      body.marketing_consent === 1
        ? 1
        : 0;


    if (!id) {

      return badRequest(
        "Customer id is required."
      );
    }


    if (
      !firstName ||
      !lastName
    ) {

      return badRequest(
        "First and last name are required."
      );
    }


    const existing =
      await env.DB
        .prepare(`
          SELECT id

          FROM customers

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `)
        .bind(
          id,
          user.business_id
        )
        .first();


    if (!existing) {

      return notFound(
        "Customer not found."
      );
    }


    if (email) {

      const duplicate =
        await env.DB
          .prepare(`
            SELECT id

            FROM customers

            WHERE
              business_id = ?
              AND lower(email) =
                  lower(?)
              AND id != ?

            LIMIT 1
          `)
          .bind(
            user.business_id,
            email,
            id
          )
          .first();


      if (duplicate) {

        return Response.json(
          {
            ok: false,
            error:
              "Another customer already uses this email address."
          },
          {
            status: 409
          }
        );
      }
    }


    await env.DB
      .prepare(`
        UPDATE customers

        SET
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          notes = ?,
          marketing_consent = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        firstName,
        lastName,
        email || null,
        phone || null,
        notes || null,
        marketingConsent,
        id,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Customer update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to update customer."
      },
      {
        status: 500
      }
    );
  }
}
