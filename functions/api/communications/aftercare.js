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
  groupAftercareKey
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
  groupName,
  input
) {
  const fallback =
    aftercareContentFor(
      groupName
    ) ||
    genericAftercareTemplate(
      groupName
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
        groupName
      )
        .trim()
        .slice(0, 120) ||
      groupName,
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


async function groupRows(
  env,
  businessId
) {
  const rows =
    await env.DB
      .prepare(`
        SELECT
          COALESCE(
            NULLIF(
              TRIM(
                booking_group
              ),
              ''
            ),
            name
          ) AS group_name,

          MIN(sort_order) AS group_sort,

          MIN(id) AS representative_service_id

        FROM services

        WHERE
          business_id = ?
          AND is_active = 1
          AND COALESCE(
            service_type,
            'standard'
          ) != 'consultation'

        GROUP BY
          COALESCE(
            NULLIF(
              TRIM(
                booking_group
              ),
              ''
            ),
            name
          )

        ORDER BY
          group_sort ASC,
          group_name COLLATE NOCASE ASC
      `)
      .bind(
        businessId
      )
      .all();

  return rows.results || [];
}


async function validGroup(
  env,
  businessId,
  groupName
) {
  const groups =
    await groupRows(
      env,
      businessId
    );

  return groups.find(
    item =>
      String(
        item.group_name ||
        ""
      ) ===
      groupName
  ) || null;
}


async function storedGroupSettings(
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
            'communications.aftercare.group.%'
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
    const encoded =
      String(
        row.setting_key ||
        ""
      ).replace(
        "communications.aftercare.group.",
        ""
      );

    let groupName = "";

    try {
      groupName =
        decodeURIComponent(
          encoded
        );
    } catch {
      groupName =
        encoded;
    }

    try {
      map[groupName] =
        JSON.parse(
          row.setting_value
        );
    } catch {
      map[groupName] =
        null;
    }
  }

  return map;
}


async function upsertGroupSetting({
  env,
  businessId,
  groupName,
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
      groupAftercareKey(
        groupName
      ),
      JSON.stringify(
        value
      )
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

    const [
      groups,
      stored,
      legacyTemplates
    ] =
      await Promise.all([
        groupRows(
          env,
          user.business_id
        ),
        storedGroupSettings(
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
      const group of groups
    ) {
      const groupName =
        String(
          group.group_name ||
          ""
        );

      const explicit =
        stored[
          groupName
        ];

      const starter =
        aftercareContentFor(
          groupName
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
              groupName
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
                groupName,
                explicit.template ||
                explicit
              ) ||
              defaultTemplate
            )
          : defaultTemplate;

      result.push({
        /*
         * Keep these response property names for the existing UI,
         * but the id/name now represent the MAIN service group.
         */
        service_id:
          groupName,
        service_name:
          groupName,
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

    const groupName =
      String(
        body.service_id ||
        body.group_name ||
        ""
      )
        .trim()
        .slice(
          0,
          160
        );

    const group =
      await validGroup(
        env,
        user.business_id,
        groupName
      );

    if (!group) {
      return Response.json(
        {
          ok: false,
          error:
            "Choose a valid treatment service group."
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
        groupName,
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
        groupName
      ) ||
      genericAftercareTemplate(
        groupName
      );

    await upsertGroupSetting({
      env,
      businessId:
        user.business_id,
      groupName,
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
        groupName,
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

    const groupName =
      String(
        url.searchParams.get(
          "service_id"
        ) ||
        url.searchParams.get(
          "group_name"
        ) ||
        ""
      )
        .trim()
        .slice(
          0,
          160
        );

    const group =
      await validGroup(
        env,
        user.business_id,
        groupName
      );

    if (!group) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid treatment service group."
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
        groupAftercareKey(
          groupName
        )
      )
      .run();

    const starter =
      aftercareContentFor(
        groupName
      );

    const template =
      starter
        ? (
            (
              await getBusinessAftercareTemplates(
                env,
                user.business_id
              )
            )[
              starter.key
            ] ||
            starter
          )
        : genericAftercareTemplate(
            groupName
          );

    return Response.json({
      ok: true,
      service_id:
        groupName,
      enabled:
        Boolean(
          starter
        ),
      template,
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
