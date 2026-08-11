import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  runDueReminders
} from "../../../lib/communications.js";

async function getUserContext(request, env) {
  const token =
    readSessionToken(request);

  if (!token) return null;

  const tokenHash =
    await hashSessionToken(token);

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
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(tokenHash)
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

    const rows =
      await env.DB
        .prepare(`
          SELECT
            cc.id,
            cc.appointment_id,
            cc.communication_type,
            cc.recipient,
            cc.subject,
            cc.status,
            cc.provider,
            cc.provider_reference,
            cc.sent_at,
            cc.error_details,
            cc.created_at,

            c.first_name,
            c.last_name,

            s.name AS service_name,
            a.start_at

          FROM customer_communications cc

          LEFT JOIN customers c
            ON c.id =
               cc.customer_id

          LEFT JOIN appointments a
            ON a.id =
               cc.appointment_id

          LEFT JOIN services s
            ON s.id =
               a.service_id

          WHERE
            cc.business_id = ?

          ORDER BY
            datetime(
              COALESCE(
                cc.sent_at,
                cc.created_at
              )
            ) DESC

          LIMIT 200
        `)
        .bind(
          user.business_id
        )
        .all();

    return Response.json({
      ok: true,
      communications:
        rows.results ||
        []
    });
  } catch (error) {
    console.error(
      "Communications GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load communications."
      },
      {
        status: 500
      }
    );
  }
}

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

    if (
      body.action !==
      "run_reminders"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid communications action."
        },
        {
          status: 400
        }
      );
    }

    const result =
      await runDueReminders({
        env,
        businessId:
          user.business_id
      });

    return Response.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error(
      "Manual reminder run failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to run reminders."
      },
      {
        status: 500
      }
    );
  }
}
