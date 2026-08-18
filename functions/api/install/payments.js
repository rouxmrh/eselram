const VALID_PROVIDERS = [
  "stripe",
  "paypal",
  "sumup",
  "square",
  "manual"
];


function createId(prefix = "payprov") {
  return `${prefix}_${crypto.randomUUID()}`;
}


export async function onRequestPost({
  request,
  env
}) {

  try {

    const body =
      await request.json();


    const enabledProviders =
      Array.isArray(
        body.enabled_providers
      )
        ? [
            ...new Set(
              body.enabled_providers
                .map((value) =>
                  String(value).trim()
                )
            )
          ]
        : [];


    const defaultProvider =
      String(
        body.default_provider || ""
      ).trim();


    if (
      enabledProviders.length === 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "At least one payment method is required."
        },
        {
          status: 400
        }
      );
    }


    const invalidProvider =
      enabledProviders.find(
        (provider) =>
          !VALID_PROVIDERS.includes(
            provider
          )
      );


    if (invalidProvider) {
      return Response.json(
        {
          ok: false,
          error:
            "An invalid payment provider was supplied."
        },
        {
          status: 400
        }
      );
    }


    if (
      !enabledProviders.includes(
        defaultProvider
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The default payment method must be enabled."
        },
        {
          status: 400
        }
      );
    }


    const business =
      await env.DB
        .prepare(`
          SELECT id
          FROM businesses
          LIMIT 1
        `)
        .first();


    if (!business) {
      return Response.json(
        {
          ok: false,
          error:
            "Business setup must be completed first."
        },
        {
          status: 409
        }
      );
    }


    const [existingStripeProvider, existingStripeIntegration] =
      await Promise.all([
        env.DB
          .prepare(`
            SELECT
              connection_status,
              environment,
              external_account_reference,
              webhook_status
            FROM business_payment_providers
            WHERE business_id = ? AND provider_key = 'stripe'
            LIMIT 1
          `)
          .bind(business.id)
          .first(),

        env.DB
          .prepare(`
            SELECT
              status,
              encrypted_credentials
            FROM business_integrations
            WHERE business_id = ?
              AND integration_type = 'payments'
              AND provider = 'stripe'
            LIMIT 1
          `)
          .bind(business.id)
          .first()
      ]);


    /*
      Disable existing provider settings first.

      This makes the endpoint safe to use again
      if someone goes backwards in the installer
      and changes their choices.
    */

    await env.DB
      .prepare(`
        UPDATE business_payment_providers
        SET
          is_enabled = 0,
          is_default = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE business_id = ?
      `)
      .bind(
        business.id
      )
      .run();


    for (
      const provider
      of enabledProviders
    ) {

      const isDefault =
        provider === defaultProvider
          ? 1
          : 0;


      const stripeWasProvisioned =
        provider === "stripe" &&
        Boolean(existingStripeIntegration?.encrypted_credentials) &&
        ["configured", "verified"].includes(
          String(existingStripeIntegration?.status || "")
        );

      const connectionStatus =
        provider === "manual"
          ? "connected"
          : stripeWasProvisioned
            ? "connected"
            : (existingStripeProvider?.connection_status || "not_connected");


      const webhookStatus =
        provider === "manual"
          ? "configured"
          : (existingStripeProvider?.webhook_status || "not_configured");

      const environment =
        provider === "manual"
          ? "manual"
          : (existingStripeProvider?.environment || "sandbox");

      const externalAccountReference =
        provider === "stripe"
          ? (existingStripeProvider?.external_account_reference || null)
          : null;


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
            webhook_status
          )

          VALUES (
            ?, ?, ?, 1, ?, ?, ?, ?, ?
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
              COALESCE(excluded.external_account_reference, external_account_reference),
            webhook_status =
              excluded.webhook_status,
            updated_at =
              CURRENT_TIMESTAMP
        `)

        .bind(
          createId(),
          business.id,
          provider,
          isDefault,
          connectionStatus,
          environment,
          externalAccountReference,
          webhookStatus
        )

        .run();
    }


    await env.DB
      .prepare(`
        UPDATE installer_state

        SET
          current_step = 'owner',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = 1
      `)

      .run();


    return Response.json({
      ok: true,

      enabled_providers:
        enabledProviders,

      default_provider:
        defaultProvider,

      next_step:
        "owner"
    });


  } catch (error) {

    console.error(
      "Payment installer step failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to save payment preferences."
      },
      {
        status: 500
      }
    );
  }
}
