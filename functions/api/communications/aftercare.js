import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  aftercareContentFor,
  defaultAftercareTemplates,
  genericAftercareTemplate,
  getBusinessAftercareForService,
  getBusinessAftercareTemplates,
  serviceAftercareKey
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


function cleanTemplate(
  serviceName,
  input
) {
  const fallback =
    aftercareContentFor(
      serviceName
    ) ||
    genericAftercareTemplate(
      serviceName
    );

  const source =
    input &&
    typeof input === "object"
      ? input
      : {};

  const sections =
    Array.isArray(
      source.sections
    )
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
      String(
        tuple[0] ||
        ""
      )
        .trim()
        .slice(0, 120);

    const items =
      (
        Array.isArray(
          tuple[1]
        )
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
    key:
      fallback.key ||
      "custom_service",
    serviceLabel:
      String(
        source.serviceLabel ||
        fallback.serviceLabel ||
        serviceName
      )
        .trim()
        .slice(0, 120) ||
      serviceName,
    sections:
      cleanSections,
    note:
      String(
        source.note ||
        ""
      )
        .trim()
        .slice(0, 3000)
  };
}


async function serviceFor(
  env,
  businessId,
  serviceId
) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        service_type,
        is_active,
        sort_order

      FROM services

      WHERE
        id = ?
        AND business_id = ?

      LIMIT 1
    `)
    .bind(
      serviceId,
      businessId
    )
    .first();
}


async function upsertServiceSetting({
  env,
  businessId,
  serviceId,
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
        value_type =
          'json',
        updated_at =
          CURRENT_TIMESTAMP
    `)
    .bind(
      `set_${crypto.randomUUID()}`,
      businessId,
      serviceAftercareKey(
        serviceId
      ),
      JSON.stringify(
        value
      )
    )
    .run();
}


async function serviceRows(
  env,
  businessId
) {
  const rows =
    await env.DB
      .prepare(`
        SELECT
          id,
          name,
          service_type,
          sort_order

        FROM services

        WHERE
          business_id = ?
          AND is_active = 1
          AND COALESCE(
            service_type,
            'standard'
          ) != 'consultation'

        ORDER BY
          sort_order ASC,
          name COLLATE NOCASE ASC
      `)
      .bind(
        businessId
      )
      .all();

  return rows.results || [];
}


async function storedServiceSettings(
  env,
  businessId
) {
  const rows =
    await env.DB
      .prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key LIKE
            'communications.aftercare.service.%'
      `)
      .bind(
        businessId
      )
      .all();

  const map = {};

  for (
    const row of
    rows.results || []
  ) {
    const serviceId =
      String(
        row.setting_key ||
        ""
      ).replace(
        "communications.aftercare.service.",
        ""
      );

    try {
      map[serviceId] =
        JSON.parse(
          row.setting_value
        );
    } catch {
      map[serviceId] =
        null;
    }
  }

  return map;
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

    const [
      services,
      stored,
      legacyTemplates
    ] =
      await Promise.all([
        serviceRows(
          env,
          user.business_id
        ),
        storedServiceSettings(
          env,
          user.business_id
        ),
        getBusinessAftercareTemplates(
          env,
          user.business_id
        )
      ]);

    const result = [];

    for (
      const service of services
    ) {
      const explicit =
        stored[
          service.id
        ];

      const starter =
        aftercareContentFor(
          service.name
        );

      const defaultTemplate =
        starter
          ? (
              legacyTemplates[
                starter.key
              ] ||
              starter
            )
          : genericAftercareTemplate(
              service.name
            );

      const enabled =
        explicit
          ? explicit.enabled !==
            false
          : Boolean(
              starter
            );

      const template =
        explicit
          ? (
              cleanTemplate(
                service.name,
                explicit.template ||
                explicit
              ) ||
              defaultTemplate
            )
          : defaultTemplate;

      result.push({
        service_id:
          service.id,
        service_name:
          service.name,
        enabled,
        customised:
          Boolean(
            explicit
          ),
        has_eselram_starter:
          Boolean(
            starter
          ),
        starter_key:
          starter?.key ||
          null,
        template
      });
    }

    return Response.json({
      ok: true,
      services:
        result,
      legacy_templates:
        defaultAftercareTemplates()
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

    const serviceId =
      String(
        body.service_id ||
        ""
      ).trim();

    const service =
      await serviceFor(
        env,
        user.business_id,
        serviceId
      );

    if (
      !service ||
      String(
        service.service_type ||
        "standard"
      ) ===
      "consultation"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Choose a valid treatment service."
        },
        {
          status: 400
        }
      );
    }

    const enabled =
      body.enabled !== false;

    const template =
      cleanTemplate(
        service.name,
        body.template
      );

    if (
      enabled &&
      !template
    ) {
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

    const fallback =
      aftercareContentFor(
        service.name
      ) ||
      genericAftercareTemplate(
        service.name
      );

    await upsertServiceSetting({
      env,
      businessId:
        user.business_id,
      serviceId:
        service.id,
      value: {
        enabled,
        template:
          template ||
          fallback
      }
    });

    return Response.json({
      ok: true,
      service_id:
        service.id,
      enabled,
      template:
        template ||
        fallback
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

    const serviceId =
      String(
        url.searchParams.get(
          "service_id"
        ) ||
        ""
      ).trim();

    const service =
      await serviceFor(
        env,
        user.business_id,
        serviceId
      );

    if (!service) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid treatment service."
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
        serviceAftercareKey(
          service.id
        )
      )
      .run();

    const starter =
      aftercareContentFor(
        service.name
      );

    const template =
      await getBusinessAftercareForService(
        env,
        user.business_id,
        service.id,
        service.name
      );

    return Response.json({
      ok: true,
      service_id:
        service.id,
      enabled:
        Boolean(
          starter
        ),
      template:
        template ||
        genericAftercareTemplate(
          service.name
        ),
      restored_to:
        starter
          ? "eselram_starter"
          : "off"
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
