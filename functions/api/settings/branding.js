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
        AND datetime(s.expires_at)
            > datetime('now')
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
      error: "Authentication required."
    },
    {
      status: 401
    }
  );
}


async function getSetting(
  env,
  businessId,
  key,
  fallback
) {

  const row =
    await env.DB
      .prepare(`
        SELECT setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key = ?

        LIMIT 1
      `)
      .bind(
        businessId,
        key
      )
      .first();


  return row?.setting_value ??
    fallback;
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


    return Response.json({
      ok: true,

      branding: {
        primary_colour:
          await getSetting(
            env,
            user.business_id,
            "branding.primary_colour",
            "#365c50"
          ),

        accent_colour:
          await getSetting(
            env,
            user.business_id,
            "branding.accent_colour",
            "#68706b"
          ),

        theme:
          await getSetting(
            env,
            user.business_id,
            "branding.theme",
            "light"
          ),

        time_format:
          await getSetting(
            env,
            user.business_id,
            "display.time_format",
            "24"
          ),

        date_format:
          await getSetting(
            env,
            user.business_id,
            "display.date_format",
            "DD/MM/YYYY"
          )
      }
    });


  } catch (error) {

    console.error(
      "Branding settings GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load branding settings."
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


    const primaryColour =
      String(
        body.primary_colour || ""
      ).trim();


    const accentColour =
      String(
        body.accent_colour || ""
      ).trim();


    const theme =
      String(
        body.theme || "light"
      ).trim();


    const timeFormat =
      String(
        body.time_format || "24"
      ).trim();


    const dateFormat =
      String(
        body.date_format ||
        "DD/MM/YYYY"
      ).trim();


    const hexPattern =
      /^#[0-9a-fA-F]{6}$/;


    if (
      !hexPattern.test(
        primaryColour
      ) ||
      !hexPattern.test(
        accentColour
      )
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Please enter valid colours."
        },
        {
          status: 400
        }
      );
    }


    if (
      ![
        "light",
        "dark",
        "system"
      ].includes(theme)
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid theme."
        },
        {
          status: 400
        }
      );
    }


    if (
      !["12", "24"].includes(
        timeFormat
      )
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid time format."
        },
        {
          status: 400
        }
      );
    }


    if (
      ![
        "DD/MM/YYYY",
        "MM/DD/YYYY",
        "YYYY-MM-DD"
      ].includes(dateFormat)
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid date format."
        },
        {
          status: 400
        }
      );
    }


    const settings = [
      [
        "branding.primary_colour",
        primaryColour
      ],
      [
        "branding.accent_colour",
        accentColour
      ],
      [
        "branding.theme",
        theme
      ],
      [
        "display.time_format",
        timeFormat
      ],
      [
        "display.date_format",
        dateFormat
      ]
    ];


    for (
      const [key, value]
      of settings
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

          VALUES (
            ?, ?, ?, ?, 'string'
          )

          ON CONFLICT(
            business_id,
            setting_key
          )

          DO UPDATE SET
            setting_value =
              excluded.setting_value,
            updated_at =
              CURRENT_TIMESTAMP
        `)
        .bind(
          `set_${crypto.randomUUID()}`,
          user.business_id,
          key,
          value
        )
        .run();
    }


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Branding settings update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to save branding settings."
      },
      {
        status: 500
      }
    );
  }
}
