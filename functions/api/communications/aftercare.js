import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  defaultAftercareTemplates,
  getBusinessAftercareTemplates
} from "../../../lib/communications.js";


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


function settingKey(key) {
  return `communications.aftercare.${key}`;
}


function validKey(key) {
  return [
    "tattoo_removal",
    "carbon_facial",
    "fungal_nail"
  ].includes(key);
}


function cleanTemplate(
  key,
  input
) {
  const defaults =
    defaultAftercareTemplates();

  const fallback =
    defaults[key];

  if (!fallback) {
    return null;
  }

  const source =
    input &&
    typeof input === "object"
      ? input
      : {};

  const sections =
    Array.isArray(source.sections)
      ? source.sections
      : [];

  if (
    sections.length < 1 ||
    sections.length > 12
  ) {
    return null;
  }

  const cleanSections = [];

  for (
    const section of sections
  ) {
    const tuple =
      Array.isArray(section)
        ? section
        : [
            section?.title,
            section?.items
          ];

    const title =
      String(tuple[0] || "")
        .trim()
        .slice(0, 120);

    const items =
      (
        Array.isArray(tuple[1])
          ? tuple[1]
          : []
      )
        .map(
          item =>
            String(item || "")
              .trim()
              .slice(0, 600)
        )
        .filter(Boolean)
        .slice(0, 30);

    if (
      !title ||
      !items.length
    ) {
      return null;
    }

    cleanSections.push([
      title,
      items
    ]);
  }

  return {
    key,
    serviceLabel:
      String(
        source.serviceLabel ||
        fallback.serviceLabel
      )
        .trim()
        .slice(0, 120) ||
      fallback.serviceLabel,
    sections: cleanSections,
    note:
      String(source.note || "")
        .trim()
        .slice(0, 3000)
  };
}


async function upsertSetting({
  env,
  businessId,
  key,
  value
}) {
  await env.DB
    .prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, ?, ?, 'json')

      ON CONFLICT(
        business_id,
        setting_key
      )

      DO UPDATE SET
        setting_value =
          excluded.setting_value,
        value_type = 'json',
        updated_at =
          CURRENT_TIMESTAMP
    `)
    .bind(
      `set_${crypto.randomUUID()}`,
      businessId,
      settingKey(key),
      JSON.stringify(value)
    )
    .run();
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

    const templates =
      await getBusinessAftercareTemplates(
        env,
        user.business_id
      );

    return Response.json({
      ok: true,
      templates
    });
  } catch (error) {
    console.error(
      "Aftercare templates GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load aftercare."
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

    const key =
      String(body.key || "")
        .trim();

    if (!validKey(key)) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid aftercare treatment."
        },
        {
          status: 400
        }
      );
    }

    const template =
      cleanTemplate(
        key,
        body.template
      );

    if (!template) {
      return Response.json(
        {
          ok: false,
          error:
            "Every aftercare section needs a heading and at least one instruction."
        },
        {
          status: 400
        }
      );
    }

    await upsertSetting({
      env,
      businessId:
        user.business_id,
      key,
      value: template
    });

    return Response.json({
      ok: true,
      template
    });
  } catch (error) {
    console.error(
      "Aftercare template PUT failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to save aftercare."
      },
      {
        status: 500
      }
    );
  }
}


export async function onRequestDelete({
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
      new URL(request.url);

    const key =
      String(
        url.searchParams.get("key") ||
        ""
      ).trim();

    if (!validKey(key)) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid aftercare treatment."
        },
        {
          status: 400
        }
      );
    }

    await env.DB
      .prepare(`
        DELETE FROM business_settings

        WHERE
          business_id = ?
          AND setting_key = ?
      `)
      .bind(
        user.business_id,
        settingKey(key)
      )
      .run();

    const defaults =
      defaultAftercareTemplates();

    return Response.json({
      ok: true,
      template:
        defaults[key]
    });
  } catch (error) {
    console.error(
      "Aftercare template DELETE failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to restore aftercare."
      },
      {
        status: 500
      }
    );
  }
}
