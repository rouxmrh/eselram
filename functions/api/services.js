import {
  readSessionToken,
  hashSessionToken
} from "../../lib/auth.js";


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


function unauthorised() {

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


function moneyToMinor(value) {

  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return Math.round(
    number * 100
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
      return unauthorised();
    }


    const services =
      await env.DB
        .prepare(`
          SELECT
            id,
            name,
            description,
            duration_minutes,
            price_minor,
            deposit_minor,
            payment_timing,
            requires_consultation,
            requires_patch_test,
            is_active,
            sort_order

          FROM services

          WHERE business_id = ?

          ORDER BY
            sort_order ASC,
            name COLLATE NOCASE ASC
        `)
        .bind(
          user.business_id
        )
        .all();


    const providers =
      await env.DB
        .prepare(`
          SELECT
            bpp.provider_key,
            pp.display_name,
            bpp.is_default

          FROM business_payment_providers bpp

          JOIN payment_providers pp
            ON pp.provider_key =
               bpp.provider_key

          WHERE
            bpp.business_id = ?
            AND bpp.is_enabled = 1
            AND pp.provider_type = 'online'

          ORDER BY
            pp.sort_order ASC
        `)
        .bind(
          user.business_id
        )
        .all();


    const providerLinks =
      await env.DB
        .prepare(`
          SELECT
            spp.service_id,
            spp.provider_key

          FROM service_payment_providers spp

          JOIN services s
            ON s.id =
               spp.service_id

          WHERE
            s.business_id = ?
        `)
        .bind(
          user.business_id
        )
        .all();


    const providerMap = {};


    for (
      const row
      of providerLinks.results || []
    ) {

      if (
        !providerMap[
          row.service_id
        ]
      ) {
        providerMap[
          row.service_id
        ] = [];
      }

      providerMap[
        row.service_id
      ].push(
        row.provider_key
      );
    }


    const clientTemplates =
      await env.DB
        .prepare(`
          SELECT id, name, template_type, version
          FROM clinical_templates
          WHERE business_id = ?
            AND is_active = 1
            AND is_published = 1
            AND is_client_sendable = 1
          ORDER BY name COLLATE NOCASE ASC
        `)
        .bind(user.business_id)
        .all();

    const formRuleRows =
      await env.DB
        .prepare(`
          SELECT service_id, template_id, trigger_event, is_active
          FROM service_form_rules
          WHERE business_id = ?
        `)
        .bind(user.business_id)
        .all();

    const formRuleMap = {};
    for (const row of formRuleRows.results || []) {
      if (!formRuleMap[row.service_id]) formRuleMap[row.service_id] = [];
      formRuleMap[row.service_id].push({template_id:row.template_id,trigger_event:row.trigger_event,is_active:row.is_active});
    }

    const result =
      (services.results || [])
        .map(
          (service) => ({
            ...service,

            providers:
              providerMap[
                service.id
              ] || [],

            form_rules:
              formRuleMap[
                service.id
              ] || []
          })
        );


    return Response.json({
      ok: true,
      services: result,
      providers:
        providers.results || [],

      client_templates:
        clientTemplates.results || []
    });


  } catch (error) {

    console.error(
      "Services GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load services."
      },
      {
        status: 500
      }
    );
  }
}


async function saveService({
  request,
  env,
  updating
}) {

  const user =
    await getUserContext(
      request,
      env
    );


  if (!user) {
    return unauthorised();
  }


  const body =
    await request.json();


  const id =
    String(
      body.id || ""
    ).trim();


  const name =
    String(
      body.name || ""
    ).trim();


  const description =
    String(
      body.description || ""
    ).trim();


  const duration =
    Number(
      body.duration_minutes
    );


  const priceMinor =
    moneyToMinor(
      body.price
    );


  const depositMinor =
    moneyToMinor(
      body.deposit || 0
    );


  const paymentTiming =
    String(
      body.payment_timing ||
      "pay_at_appointment"
    );


  const providers =
    Array.isArray(
      body.providers
    )
      ? [
          ...new Set(
            body.providers.map(
              (provider) =>
                String(provider)
            )
          )
        ]
      : [];


  const formRules =
    Array.isArray(body.form_rules)
      ? body.form_rules
          .map((rule) => ({
            template_id: String(rule?.template_id || "").trim(),
            trigger_event: String(rule?.trigger_event || "manual").trim()
          }))
          .filter((rule) => rule.template_id)
      : [];

  const validFormTriggers = [
    "payment_received",
    "booking_confirmed",
    "manual"
  ];

  for (const rule of formRules) {
    if (!validFormTriggers.includes(rule.trigger_event)) {
      return Response.json({ok:false,error:"Invalid client form trigger."},{status:400});
    }
  }

  const validTiming = [
    "online_full",
    "online_deposit",
    "pay_at_appointment",
    "free"
  ];


  if (!name) {

    return Response.json(
      {
        ok: false,
        error:
          "Service name is required."
      },
      {
        status: 400
      }
    );
  }


  if (
    !Number.isInteger(duration) ||
    duration <= 0
  ) {

    return Response.json(
      {
        ok: false,
        error:
          "A valid duration is required."
      },
      {
        status: 400
      }
    );
  }


  if (
    priceMinor === null ||
    depositMinor === null
  ) {

    return Response.json(
      {
        ok: false,
        error:
          "Invalid price."
      },
      {
        status: 400
      }
    );
  }


  if (
    !validTiming.includes(
      paymentTiming
    )
  ) {

    return Response.json(
      {
        ok: false,
        error:
          "Invalid payment rule."
      },
      {
        status: 400
      }
    );
  }


  if (
    paymentTiming ===
      "online_deposit" &&
    (
      depositMinor <= 0 ||
      depositMinor > priceMinor
    )
  ) {

    return Response.json(
      {
        ok: false,
        error:
          "Deposit must be greater than zero and cannot exceed the service price."
      },
      {
        status: 400
      }
    );
  }


  if (
    (
      paymentTiming ===
        "online_full" ||
      paymentTiming ===
        "online_deposit"
    ) &&
    providers.length === 0
  ) {

    return Response.json(
      {
        ok: false,
        error:
          "Choose at least one online payment provider."
      },
      {
        status: 400
      }
    );
  }


  if (formRules.length) {
    const selectedIds = [...new Set(formRules.map((rule) => rule.template_id))];
    const placeholders = selectedIds.map(() => "?").join(", ");
    const templates = await env.DB
      .prepare(`SELECT id FROM clinical_templates WHERE business_id = ? AND is_active = 1 AND is_published = 1 AND is_client_sendable = 1 AND id IN (${placeholders})`)
      .bind(user.business_id, ...selectedIds)
      .all();
    const validIds = new Set((templates.results || []).map((row) => row.id));
    if (selectedIds.some((templateId) => !validIds.has(templateId))) {
      return Response.json({ok:false,error:"One or more selected client forms are unavailable."},{status:400});
    }
  }

  let serviceId = id;


  if (updating) {

    if (!serviceId) {

      return Response.json(
        {
          ok: false,
          error:
            "Service ID is required."
        },
        {
          status: 400
        }
      );
    }


    const existing =
      await env.DB
        .prepare(`
          SELECT id

          FROM services

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `)
        .bind(
          serviceId,
          user.business_id
        )
        .first();


    if (!existing) {

      return Response.json(
        {
          ok: false,
          error:
            "Service not found."
        },
        {
          status: 404
        }
      );
    }


    await env.DB
      .prepare(`
        UPDATE services

        SET
          name = ?,
          description = ?,
          duration_minutes = ?,
          price_minor = ?,
          deposit_minor = ?,
          payment_timing = ?,

          payment_mode =
            CASE ?
              WHEN 'online_full'
                THEN 'stripe_full'

              WHEN 'online_deposit'
                THEN 'stripe_deposit'

              WHEN 'free'
                THEN 'free'

              ELSE
                'pay_at_appointment'
            END,

          requires_consultation = ?,
          requires_patch_test = ?,
          is_active = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        name,
        description || null,
        duration,
        priceMinor,
        depositMinor,
        paymentTiming,
        paymentTiming,
        body.requires_consultation
          ? 1
          : 0,
        body.requires_patch_test
          ? 1
          : 0,
        body.is_active
          ? 1
          : 0,
        serviceId,
        user.business_id
      )
      .run();

  } else {

    serviceId =
      `svc_${crypto.randomUUID()}`;


    await env.DB
      .prepare(`
        INSERT INTO services (
          id,
          business_id,
          name,
          description,
          duration_minutes,
          price_minor,
          deposit_minor,
          payment_mode,
          payment_timing,
          requires_consultation,
          requires_patch_test,
          is_active
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          CASE ?
            WHEN 'online_full'
              THEN 'stripe_full'

            WHEN 'online_deposit'
              THEN 'stripe_deposit'

            WHEN 'free'
              THEN 'free'

            ELSE
              'pay_at_appointment'
          END,
          ?, ?, ?, ?
        )
      `)
      .bind(
        serviceId,
        user.business_id,
        name,
        description || null,
        duration,
        priceMinor,
        depositMinor,
        paymentTiming,
        paymentTiming,
        body.requires_consultation
          ? 1
          : 0,
        body.requires_patch_test
          ? 1
          : 0,
        body.is_active
          ? 1
          : 0
      )
      .run();
  }


  await env.DB
    .prepare(`
      DELETE FROM service_form_rules
      WHERE business_id = ? AND service_id = ?
    `)
    .bind(user.business_id, serviceId)
    .run();

  for (const rule of formRules) {
    await env.DB
      .prepare(`
        INSERT INTO service_form_rules (id,business_id,service_id,template_id,trigger_event,is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `)
      .bind(`sfr_${crypto.randomUUID()}`,user.business_id,serviceId,rule.template_id,rule.trigger_event)
      .run();
  }

  await env.DB
    .prepare(`
      DELETE FROM service_payment_providers

      WHERE service_id = ?
    `)
    .bind(
      serviceId
    )
    .run();


  if (
    paymentTiming ===
      "online_full" ||
    paymentTiming ===
      "online_deposit"
  ) {

    for (
      const provider
      of providers
    ) {

      const validProvider =
        await env.DB
          .prepare(`
            SELECT 1

            FROM business_payment_providers

            WHERE
              business_id = ?
              AND provider_key = ?
              AND is_enabled = 1

            LIMIT 1
          `)
          .bind(
            user.business_id,
            provider
          )
          .first();


      if (!validProvider) {
        continue;
      }


      await env.DB
        .prepare(`
          INSERT OR IGNORE
          INTO service_payment_providers (
            service_id,
            provider_key
          )

          VALUES (?, ?)
        `)
        .bind(
          serviceId,
          provider
        )
        .run();
    }
  }


  return Response.json({
    ok: true,
    service_id: serviceId
  });
}


export async function onRequestPost(
  context
) {

  try {

    return await saveService({
      ...context,
      updating: false
    });

  } catch (error) {

    console.error(
      "Service creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to create service."
      },
      {
        status: 500
      }
    );
  }
}


export async function onRequestPut(
  context
) {

  try {

    return await saveService({
      ...context,
      updating: true
    });

  } catch (error) {

    console.error(
      "Service update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to update service."
      },
      {
        status: 500
      }
    );
  }
}
