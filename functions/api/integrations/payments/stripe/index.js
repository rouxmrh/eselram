import {
  readSessionToken,
  hashSessionToken
} from "../../../../../lib/auth.js";

import {
  encryptIntegrationSecret,
  decryptIntegrationSecret
} from "../../../../../lib/integration-crypto.js";


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
        u.business_id,
        b.currency

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      JOIN businesses b
        ON b.id =
           u.business_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
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


function parseJson(
  value,
  fallback = {}
) {

  if (!value) {
    return fallback;
  }


  try {
    return JSON.parse(
      value
    );
  } catch {
    return fallback;
  }
}


async function getIntegration(
  env,
  businessId
) {

  return await env.DB
    .prepare(`
      SELECT
        id,
        provider,
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error,
        created_at,
        updated_at

      FROM business_integrations

      WHERE
        business_id = ?
        AND integration_type =
            'payments'

      LIMIT 1
    `)
    .bind(
      businessId
    )
    .first();
}


async function upsertStripeProvider({
  env,
  businessId,
  connectionStatus,
  environment,
  externalAccountReference = null,
  webhookStatus = "not_configured",
  makeDefault = false
}) {

  if (makeDefault) {

    await env.DB
      .prepare(`
        UPDATE business_payment_providers

        SET
          is_default = 0,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE business_id = ?
      `)
      .bind(
        businessId
      )
      .run();
  }


  await env.DB
    .prepare(`
      INSERT INTO business_payment_providers (
        id,
        business_id,
        provider_key,
        is_enabled,
        is_default,
        connection_status,
        environment,
        external_account_reference,
        webhook_status,
        last_sync_at
      )

      VALUES (
        ?,
        ?,
        'stripe',
        1,
        ?,
        ?,
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT(
        business_id,
        provider_key
      )

      DO UPDATE SET
        is_enabled = 1,
        is_default =
          excluded.is_default,
        connection_status =
          excluded.connection_status,
        environment =
          excluded.environment,
        external_account_reference =
          excluded.external_account_reference,
        webhook_status =
          excluded.webhook_status,
        last_sync_at =
          CURRENT_TIMESTAMP,
        updated_at =
          CURRENT_TIMESTAMP
    `)
    .bind(
      `payprov_${crypto.randomUUID()}`,
      businessId,
      makeDefault ? 1 : 0,
      connectionStatus,
      environment,
      externalAccountReference,
      webhookStatus
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


    const origin =
      new URL(
        request.url
      ).origin;


    const webhookUrl =
      `${origin}/api/payments/stripe/webhook?business_id=${encodeURIComponent(
        user.business_id
      )}`;


    const integration =
      await getIntegration(
        env,
        user.business_id
      );


    const provider =
      await env.DB
        .prepare(`
          SELECT
            is_enabled,
            is_default,
            connection_status,
            environment,
            external_account_reference,
            webhook_status,
            last_sync_at

          FROM business_payment_providers

          WHERE
            business_id = ?
            AND provider_key =
                'stripe'

          LIMIT 1
        `)
        .bind(
          user.business_id
        )
        .first();


    const manualProvider =
      await env.DB
        .prepare(`
          SELECT
            is_enabled,
            is_default,
            connection_status
          FROM business_payment_providers
          WHERE
            business_id = ?
            AND provider_key = 'manual'
          LIMIT 1
        `)
        .bind(user.business_id)
        .first();


    if (!integration) {

      return Response.json({
        ok: true,

        integration: {
          provider:
            "stripe",
          status:
            "not_configured",
          has_secret_key:
            false,
          has_webhook_secret:
            false,
          publishable_key:
            "",
          currency:
            user.currency ||
            "GBP",
          mode:
            "unknown",
          is_default:
            manualProvider?.is_enabled === 1 &&
            manualProvider?.is_default === 1
              ? false
              : provider?.is_default === 1,
          default_provider:
            manualProvider?.is_enabled === 1 &&
            manualProvider?.is_default === 1
              ? "manual"
              : provider?.is_default === 1
                ? "stripe"
                : null,
          manual_enabled:
            manualProvider?.is_enabled === 1,
          manual_is_default:
            manualProvider?.is_default === 1,
          connection_status:
            provider?.connection_status ||
            "not_connected",
          webhook_status:
            provider?.webhook_status ||
            "not_configured",
          last_tested_at:
            null,
          last_error:
            null,
          webhook_url:
            webhookUrl
        },

        encryption_ready:
          Boolean(
            String(
              env.ESELRAM_ENCRYPTION_KEY ||
              ""
            ).trim()
          )
      });
    }


    const config =
      parseJson(
        integration.config_json,
        {}
      );


    return Response.json({
      ok: true,

      integration: {
        provider:
          "stripe",
        status:
          integration.status,
        has_secret_key:
          Boolean(
            integration.encrypted_credentials
          ),
        has_webhook_secret:
          Boolean(
            config.has_webhook_secret
          ),
        publishable_key:
          config.publishable_key ||
          "",
        currency:
          config.currency ||
          user.currency ||
          "GBP",
        mode:
          config.mode ||
          provider?.environment ||
          "unknown",
        is_default:
          manualProvider?.is_enabled === 1 &&
          manualProvider?.is_default === 1
            ? false
            : provider?.is_default === 1,
        default_provider:
          manualProvider?.is_enabled === 1 &&
          manualProvider?.is_default === 1
            ? "manual"
            : provider?.is_default === 1
              ? "stripe"
              : null,
        manual_enabled:
          manualProvider?.is_enabled === 1,
        manual_is_default:
          manualProvider?.is_default === 1,
        connection_status:
          provider?.connection_status ||
          "not_connected",
        webhook_status:
          provider?.webhook_status ||
          "not_configured",
        last_tested_at:
          integration.last_tested_at,
        last_error:
          integration.last_error,
        webhook_url:
          webhookUrl,
        connected_account_id:
          config.connected_account_id ||
          provider?.external_account_reference ||
          null,
        connected_via:
          config.connected_via || null,
        provisioned_connection:
          Boolean(
            integration.encrypted_credentials &&
            (
              provider?.connection_status === "connected" ||
              config.connected_via === "provisioner"
            )
          )
      },

      encryption_ready:
        Boolean(
          String(
            env.ESELRAM_ENCRYPTION_KEY ||
            ""
          ).trim()
        )
    });


  } catch (error) {

    console.error(
      "Stripe integration GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load Stripe settings."
      },
      {
        status: 500
      }
    );
  }
}


export async function onRequestPatch({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const body = await request.json();
    if (String(body.default_provider || "") !== "manual") {
      return badRequest("Only Pay in person can be selected here without connecting Stripe.");
    }

    // The provisioner already creates the manual provider for every business.
    // Keep this update compatible with the installed schema: do not rely on
    // optional timestamp columns or a composite UNIQUE constraint.
    await env.DB.prepare(`
      UPDATE business_payment_providers
      SET is_default = 0
      WHERE business_id = ?
    `).bind(user.business_id).run();

    const manualResult = await env.DB.prepare(`
      UPDATE business_payment_providers
      SET is_enabled = 1,
          is_default = 1,
          connection_status = 'connected',
          environment = 'manual',
          webhook_status = 'configured'
      WHERE business_id = ? AND provider_key = 'manual'
    `).bind(user.business_id).run();

    // Defensive fallback for older installations where the manual row was
    // not provisioned. Avoid ON CONFLICT because older schemas may not have
    // the required composite unique index.
    if (!manualResult?.meta?.changes) {
      await env.DB.prepare(`
        INSERT INTO business_payment_providers (
          id, business_id, provider_key, is_enabled, is_default,
          connection_status, environment, webhook_status
        ) VALUES (?, ?, 'manual', 1, 1, 'connected', 'manual', 'configured')
      `).bind(`payprov_${crypto.randomUUID()}`, user.business_id).run();
    }

    return Response.json({ ok: true, default_provider: "manual" });
  } catch (error) {
    console.error("Manual payment default update failed:", error);
    return Response.json({ ok: false, error: "Unable to set Pay in person as the default payment method." }, { status: 500 });
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


    if (
      !String(
        env.ESELRAM_ENCRYPTION_KEY ||
        ""
      ).trim()
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "This Eselram installation does not have ESELRAM_ENCRYPTION_KEY configured."
        },
        {
          status: 503
        }
      );
    }


    const body =
      await request.json();


    const secretKey =
      String(
        body.secret_key ||
        ""
      ).trim();


    const publishableKey =
      String(
        body.publishable_key ||
        ""
      ).trim();


    const webhookSecret =
      String(
        body.webhook_secret ||
        ""
      ).trim();


    const currency =
      String(
        body.currency ||
        user.currency ||
        "GBP"
      )
        .trim()
        .toUpperCase();


    const makeDefault =
      body.make_default === true;


    if (
      publishableKey &&
      !publishableKey.startsWith(
        "pk_"
      )
    ) {

      return badRequest(
        "The Stripe publishable key does not look valid."
      );
    }


    if (
      secretKey &&
      !(
        secretKey.startsWith(
          "sk_test_"
        ) ||
        secretKey.startsWith(
          "sk_live_"
        ) ||
        secretKey.startsWith(
          "rk_test_"
        ) ||
        secretKey.startsWith(
          "rk_live_"
        )
      )
    ) {

      return badRequest(
        "The Stripe secret or restricted key does not look valid."
      );
    }


    if (
      webhookSecret &&
      !webhookSecret.startsWith(
        "whsec_"
      )
    ) {

      return badRequest(
        "The Stripe webhook signing secret does not look valid."
      );
    }


    const existing =
      await getIntegration(
        env,
        user.business_id
      );


    let existingCredentials = {};


    if (
      existing?.encrypted_credentials
    ) {

      try {

        existingCredentials =
          JSON.parse(
            await decryptIntegrationSecret(
              existing.encrypted_credentials,
              env.ESELRAM_ENCRYPTION_KEY
            )
          );

      } catch (error) {

        console.error(
          "Unable to decrypt existing Stripe credentials:",
          error
        );


        if (!secretKey) {

          return Response.json(
            {
              ok: false,
              error:
                "The saved Stripe credentials cannot be read. Paste the Stripe key again."
            },
            {
              status: 503
            }
          );
        }
      }
    }


    const finalSecretKey =
      secretKey ||
      String(
        existingCredentials.secret_key ||
        ""
      ).trim();


    const finalWebhookSecret =
      webhookSecret ||
      String(
        existingCredentials.webhook_secret ||
        ""
      ).trim();


    if (!finalSecretKey) {

      return badRequest(
        "A Stripe secret or restricted API key is required."
      );
    }


    const mode =
      finalSecretKey.includes(
        "_live_"
      )
        ? "live"
        : "sandbox";


    const encryptedCredentials =
      await encryptIntegrationSecret(
        JSON.stringify({
          secret_key:
            finalSecretKey,
          webhook_secret:
            finalWebhookSecret ||
            null
        }),
        env.ESELRAM_ENCRYPTION_KEY
      );


    const configJson =
      JSON.stringify({
        publishable_key:
          publishableKey ||
          parseJson(
            existing?.config_json,
            {}
          ).publishable_key ||
          "",
        currency,
        mode,
        has_webhook_secret:
          Boolean(
            finalWebhookSecret
          )
      });


    if (existing) {

      await env.DB
        .prepare(`
          UPDATE business_integrations

          SET
            provider = 'stripe',
            encrypted_credentials = ?,
            config_json = ?,
            status = 'configured',
            last_error = NULL,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            business_id = ?
            AND integration_type =
                'payments'
        `)
        .bind(
          encryptedCredentials,
          configJson,
          user.business_id
        )
        .run();

    } else {

      await env.DB
        .prepare(`
          INSERT INTO business_integrations (
            id,
            business_id,
            integration_type,
            provider,
            encrypted_credentials,
            config_json,
            status
          )

          VALUES (
            ?,
            ?,
            'payments',
            'stripe',
            ?,
            ?,
            'configured'
          )
        `)
        .bind(
          `bi_${crypto.randomUUID()}`,
          user.business_id,
          encryptedCredentials,
          configJson
        )
        .run();
    }


    const existingProviderRow =
      await env.DB
        .prepare(`
          SELECT connection_status
          FROM business_payment_providers
          WHERE business_id = ?
            AND provider_key = 'stripe'
          LIMIT 1
        `)
        .bind(user.business_id)
        .first();

    await upsertStripeProvider({
      env,
      businessId:
        user.business_id,
      connectionStatus:
        existingProviderRow?.connection_status === "connected"
          ? "connected"
          : "not_connected",
      environment:
        mode,
      webhookStatus:
        finalWebhookSecret
          ? "configured"
          : "not_configured",
      makeDefault
    });


    return Response.json({
      ok: true,

      integration: {
        provider:
          "stripe",
        status:
          "configured",
        has_secret_key:
          true,
        has_webhook_secret:
          Boolean(
            finalWebhookSecret
          ),
        publishable_key:
          publishableKey,
        currency,
        mode
      }
    });


  } catch (error) {

    console.error(
      "Stripe integration PUT failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to save Stripe settings."
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
      String(
        body.action ||
        ""
      ) !== "test"
    ) {

      return badRequest(
        "Invalid Stripe integration action."
      );
    }


    const integration =
      await getIntegration(
        env,
        user.business_id
      );


    if (
      !integration ||
      !integration.encrypted_credentials
    ) {

      return badRequest(
        "Save the Stripe settings before testing the connection."
      );
    }


    let credentials;


    try {

      credentials =
        JSON.parse(
          await decryptIntegrationSecret(
            integration.encrypted_credentials,
            env.ESELRAM_ENCRYPTION_KEY
          )
        );

    } catch (error) {

      console.error(
        "Stripe credential decrypt failed:",
        error
      );


      return Response.json(
        {
          ok: false,
          error:
            "The stored Stripe credentials cannot be read. Save the Stripe key again."
        },
        {
          status: 503
        }
      );
    }


    const secretKey =
      String(
        credentials.secret_key ||
        ""
      ).trim();


    if (!secretKey) {

      return badRequest(
        "The stored Stripe API key is missing."
      );
    }


    /*
      Stripe's balance endpoint returns the balance for the
      account authenticated by the supplied key. This gives
      us a lightweight connection/authentication test without
      creating a charge or changing the account.
    */

    const stripeResponse =
      await fetch(
        "https://api.stripe.com/v1/balance",
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${secretKey}`
          }
        }
      );


    let stripeData = {};


    try {

      stripeData =
        await stripeResponse.json();

    } catch {

      stripeData = {};
    }


    if (!stripeResponse.ok) {

      const stripeError =
        String(
          stripeData?.error?.message ||
          "Stripe rejected the API key."
        );


      await env.DB
        .prepare(`
          UPDATE business_integrations

          SET
            status = 'error',
            last_tested_at =
              CURRENT_TIMESTAMP,
            last_error = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            business_id = ?
            AND integration_type =
                'payments'
        `)
        .bind(
          stripeError.slice(
            0,
            1000
          ),
          user.business_id
        )
        .run();


      await upsertStripeProvider({
        env,
        businessId:
          user.business_id,
        connectionStatus:
          "error",
        environment:
          secretKey.includes(
            "_live_"
          )
            ? "live"
            : "sandbox",
        webhookStatus:
          credentials.webhook_secret
            ? "configured"
            : "not_configured",
        makeDefault:
          false
      });


      return Response.json(
        {
          ok: false,
          error:
            stripeError
        },
        {
          status: 502
        }
      );
    }


    const config =
      parseJson(
        integration.config_json,
        {}
      );


    const mode =
      stripeData.livemode
        ? "live"
        : "sandbox";


    await env.DB
      .prepare(`
        UPDATE business_integrations

        SET
          status = 'verified',
          config_json = ?,
          last_tested_at =
            CURRENT_TIMESTAMP,
          last_error = NULL,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          business_id = ?
          AND integration_type =
              'payments'
      `)
      .bind(
        JSON.stringify({
          ...config,
          mode,
          last_balance_currency:
            stripeData.available?.[0]?.currency?.toUpperCase?.() ||
            config.currency ||
            user.currency ||
            "GBP"
        }),
        user.business_id
      )
      .run();


    await upsertStripeProvider({
      env,
      businessId:
        user.business_id,
      connectionStatus:
        "connected",
      environment:
        mode,
      webhookStatus:
        credentials.webhook_secret
          ? "configured"
          : "not_configured",
      makeDefault:
        true
    });


    return Response.json({
      ok: true,

      message:
        `Stripe connection verified in ${mode === "live" ? "live" : "test"} mode.`,

      stripe: {
        livemode:
          Boolean(
            stripeData.livemode
          ),
        available_currencies:
          [
            ...new Set(
              (
                stripeData.available ||
                []
              ).map(
                row =>
                  String(
                    row.currency ||
                    ""
                  ).toUpperCase()
              ).filter(
                Boolean
              )
            )
          ]
      }
    });


  } catch (error) {

    console.error(
      "Stripe integration test failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to test Stripe connection."
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


    await env.DB
      .prepare(`
        DELETE FROM business_integrations

        WHERE
          business_id = ?
          AND integration_type =
              'payments'
      `)
      .bind(
        user.business_id
      )
      .run();


    await env.DB
      .prepare(`
        UPDATE business_payment_providers

        SET
          is_enabled = 0,
          is_default = 0,
          connection_status =
            'not_connected',
          external_account_reference =
            NULL,
          webhook_status =
            'not_configured',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          business_id = ?
          AND provider_key =
              'stripe'
      `)
      .bind(
        user.business_id
      )
      .run();


    /*
      Keep Pay at appointment available as the safe fallback
      when an online provider is disconnected.
    */

    await env.DB
      .prepare(`
        INSERT INTO business_payment_providers (
          id,
          business_id,
          provider_key,
          is_enabled,
          is_default,
          connection_status,
          environment,
          webhook_status
        )

        VALUES (
          ?,
          ?,
          'manual',
          1,
          1,
          'connected',
          'live',
          'configured'
        )

        ON CONFLICT(
          business_id,
          provider_key
        )

        DO UPDATE SET
          is_enabled = 1,
          is_default = 1,
          connection_status =
            'connected',
          webhook_status =
            'configured',
          updated_at =
            CURRENT_TIMESTAMP
      `)
      .bind(
        `payprov_${crypto.randomUUID()}`,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Stripe integration DELETE failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to disconnect Stripe."
      },
      {
        status: 500
      }
    );
  }
}
