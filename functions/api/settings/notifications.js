import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  getCommunicationSettings
} from "../../../lib/communications.js";

async function getUserContext(request, env) {
  const token =
    readSessionToken(request);

  if (!token) {
    return null;
  }

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

async function upsert(
  env,
  businessId,
  key,
  value,
  type
) {
  await env.DB
    .prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, ?, ?, ?)

      ON CONFLICT(
        business_id,
        setting_key
      )

      DO UPDATE SET
        setting_value =
          excluded.setting_value,
        value_type =
          excluded.value_type,
        updated_at =
          CURRENT_TIMESTAMP
    `)
    .bind(
      `set_${crypto.randomUUID()}`,
      businessId,
      key,
      String(value),
      type
    )
    .run();
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

    const settings =
      await getCommunicationSettings(
        env,
        user.business_id
      );

    return Response.json({
      ok: true,
      settings
    });
  } catch (error) {
    console.error(
      "Notification settings GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load notification settings."
      },
      {
        status: 500
      }
    );
  }
}

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

    const reminderHours =
      Number(
        body.reminder_hours_before
      );

    const allowedHours = [
      1,
      2,
      6,
      12,
      24,
      48,
      72
    ];

    if (
      !allowedHours.includes(
        reminderHours
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid reminder timing."
        },
        {
          status: 400
        }
      );
    }

    await Promise.all([
      upsert(
        env,
        user.business_id,
        "notifications_booking_confirmation_enabled",
        body.booking_confirmation_enabled
          ? "1"
          : "0",
        "boolean"
      ),

      upsert(
        env,
        user.business_id,
        "notifications_reminder_enabled",
        body.reminder_enabled
          ? "1"
          : "0",
        "boolean"
      ),

      upsert(
        env,
        user.business_id,
        "notifications_reminder_hours_before",
        reminderHours,
        "number"
      ),

      upsert(
        env,
        user.business_id,
        "notifications_cancellation_enabled",
        body.cancellation_enabled
          ? "1"
          : "0",
        "boolean"
      ),

      upsert(
        env,
        user.business_id,
        "notifications_reschedule_enabled",
        body.reschedule_enabled
          ? "1"
          : "0",
        "boolean"
      )
    ]);

    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error(
      "Notification settings PUT failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to save notification settings."
      },
      {
        status: 500
      }
    );
  }
}
