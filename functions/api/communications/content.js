import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  EMAIL_TEMPLATE_DEFAULTS,
  PUBLIC_BOOKING_DEFAULTS,
  cleanEmailTemplate,
  emailTemplateSettingKey,
  getBusinessEmailOverrides,
  getBusinessEmailTemplates,
  getPublicBookingCopyOverrides,
  publicBookingSettingKey
} from "../../../lib/customer-content.js";


async function getUserContext(
  request,
  env
) {
  const token =
    readSessionToken(
      request
    );

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
        AND datetime(s.expires_at) >
            datetime('now')
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


async function upsertJson({
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
      VALUES (
        ?, ?, ?, ?, 'json'
      )

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
      key,
      JSON.stringify(
        value
      )
    )
    .run();
}


async function bookingGroups(
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

          MAX(
            CASE
              WHEN
                service_type =
                  'consultation'
                OR
                requires_consultation =
                  1
              THEN 1
              ELSE 0
            END
          ) AS has_consultation

        FROM services

        WHERE
          business_id = ?
          AND is_active = 1

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
          MIN(sort_order) ASC,
          group_name COLLATE NOCASE ASC
      `)
      .bind(
        businessId
      )
      .all();

  return (
    rows.results ||
    []
  ).map(
    row => ({
      name:
        String(
          row.group_name ||
          ""
        ),
      kind:
        Number(
          row.has_consultation ||
          0
        ) === 1
          ? "consultation"
          : "standard"
    })
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

    const [
      templates,
      overrides,
      bookingCopy,
      groups
    ] =
      await Promise.all([
        getBusinessEmailTemplates(
          env,
          user.business_id
        ),

        getBusinessEmailOverrides(
          env,
          user.business_id
        ),

        getPublicBookingCopyOverrides(
          env,
          user.business_id
        ),

        bookingGroups(
          env,
          user.business_id
        )
      ]);

    return Response.json({
      ok: true,
      email_templates:
        templates,
      email_defaults:
        EMAIL_TEMPLATE_DEFAULTS,
      email_customised:
        Object.keys(
          overrides
        ),

      booking_groups:
        groups.map(
          group => ({
            ...group,
            default_copy:
              PUBLIC_BOOKING_DEFAULTS[
                group.kind
              ],
            copy:
              bookingCopy[
                group.name
              ] ||
              PUBLIC_BOOKING_DEFAULTS[
                group.kind
              ],
            customised:
              Boolean(
                bookingCopy[
                  group.name
                ]
              )
          })
        ),

      booking_variables: {
        consultation: [
          "{{consultation_duration}}",
          "{{consultation_payment}}",
          "{{consultation_credit_sentence}}",
          "{{patch_test_sentence}}",
          "{{post_consultation_sentence}}"
        ],
        standard: [
          "{{group_name}}"
        ]
      }
    });
  } catch (error) {
    console.error(
      "Communications content GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load communication content."
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

    const kind =
      String(
        body.kind ||
        ""
      ).trim();

    if (
      kind ===
      "email"
    ) {
      const key =
        String(
          body.key ||
          ""
        ).trim();

      const template =
        cleanEmailTemplate(
          key,
          body.template
        );

      if (!template) {
        return Response.json(
          {
            ok: false,
            error:
              "Invalid email template."
          },
          {
            status: 400
          }
        );
      }

      const stored =
        await getBusinessEmailOverrides(
          env,
          user.business_id
        );

      stored[key] = {
        subject:
          template.subject,
        title:
          template.title,
        intro:
          template.intro,
        closing:
          template.closing
      };

      await upsertJson({
        env,
        businessId:
          user.business_id,
        key:
          emailTemplateSettingKey(),
        value:
          stored
      });

      return Response.json({
        ok: true,
        template
      });
    }

    if (
      kind ===
      "booking_copy"
    ) {
      const group =
        String(
          body.group ||
          ""
        )
          .trim()
          .slice(
            0,
            160
          );

      const copy =
        String(
          body.copy ||
          ""
        )
          .trim()
          .slice(
            0,
            4000
          );

      if (
        !group ||
        !copy
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "Booking group and wording are required."
          },
          {
            status: 400
          }
        );
      }

      const stored =
        await getPublicBookingCopyOverrides(
          env,
          user.business_id
        );

      stored[group] =
        copy;

      await upsertJson({
        env,
        businessId:
          user.business_id,
        key:
          publicBookingSettingKey(),
        value:
          stored
      });

      return Response.json({
        ok: true,
        copy
      });
    }

    return Response.json(
      {
        ok: false,
        error:
          "Unsupported communication content."
      },
      {
        status: 400
      }
    );
  } catch (error) {
    console.error(
      "Communications content PUT failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to save communication content."
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
      new URL(
        request.url
      );

    const kind =
      String(
        url.searchParams.get(
          "kind"
        ) ||
        ""
      ).trim();

    if (
      kind ===
      "email"
    ) {
      const key =
        String(
          url.searchParams.get(
            "key"
          ) ||
          ""
        ).trim();

      if (
        !EMAIL_TEMPLATE_DEFAULTS[
          key
        ]
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "Invalid email template."
          },
          {
            status: 400
          }
        );
      }

      const stored =
        await getBusinessEmailOverrides(
          env,
          user.business_id
        );

      delete stored[key];

      await upsertJson({
        env,
        businessId:
          user.business_id,
        key:
          emailTemplateSettingKey(),
        value:
          stored
      });

      return Response.json({
        ok: true,
        template:
          EMAIL_TEMPLATE_DEFAULTS[
            key
          ]
      });
    }

    if (
      kind ===
      "booking_copy"
    ) {
      const group =
        String(
          url.searchParams.get(
            "group"
          ) ||
          ""
        ).trim();

      const stored =
        await getPublicBookingCopyOverrides(
          env,
          user.business_id
        );

      delete stored[group];

      await upsertJson({
        env,
        businessId:
          user.business_id,
        key:
          publicBookingSettingKey(),
        value:
          stored
      });

      return Response.json({
        ok: true
      });
    }

    return Response.json(
      {
        ok: false,
        error:
          "Unsupported communication content."
      },
      {
        status: 400
      }
    );
  } catch (error) {
    console.error(
      "Communications content DELETE failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to restore communication content."
      },
      {
        status: 500
      }
    );
  }
}
