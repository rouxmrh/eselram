import {
  decryptIntegrationSecret
} from "./integration-crypto.js";


export async function getBusinessStripeIntegration(
  env,
  businessId
) {

  const row =
    await env.DB
      .prepare(`
        SELECT
          id,
          provider,
          encrypted_credentials,
          config_json,
          status,
          last_tested_at,
          last_error

        FROM business_integrations

        WHERE
          business_id = ?
          AND integration_type = 'payments'
          AND provider = 'stripe'

        LIMIT 1
      `)
      .bind(
        businessId
      )
      .first();


  if (
    !row ||
    !row.encrypted_credentials
  ) {

    return {
      error:
        "Stripe is not configured for this business."
    };
  }


  if (
    !String(
      env.ESELRAM_ENCRYPTION_KEY ||
      ""
    ).trim()
  ) {

    return {
      error:
        "ESELRAM_ENCRYPTION_KEY is not configured."
    };
  }


  let credentials;
  let config = {};


  try {

    credentials =
      JSON.parse(
        await decryptIntegrationSecret(
          row.encrypted_credentials,
          env.ESELRAM_ENCRYPTION_KEY
        )
      );


    config =
      JSON.parse(
        row.config_json ||
        "{}"
      );

  } catch (error) {

    console.error(
      "Unable to decrypt Stripe integration:",
      error
    );


    return {
      error:
        "The Stripe integration could not be read. Reconnect Stripe in Settings."
    };
  }


  const secretKey =
    String(
      credentials.secret_key ||
      ""
    ).trim();


  if (!secretKey) {

    return {
      error:
        "The saved Stripe server-side key is missing."
    };
  }


  return {
    row,
    credentials,
    config,
    secretKey,
    webhookSecret:
      String(
        credentials.webhook_secret ||
        ""
      ).trim()
  };
}


export async function stripeRequest({
  secretKey,
  path,
  method = "GET",
  body = null
}) {

  const options = {
    method,

    headers: {
      Authorization:
        `Bearer ${secretKey}`
    }
  };


  if (body) {

    options.headers[
      "Content-Type"
    ] =
      "application/x-www-form-urlencoded";

    options.body =
      body instanceof URLSearchParams
        ? body.toString()
        : String(body);
  }


  const response =
    await fetch(
      `https://api.stripe.com${path}`,
      options
    );


  let data = {};


  try {

    data =
      await response.json();

  } catch {

    data = {};
  }


  return {
    response,
    data
  };
}


export function stripeErrorMessage(
  data,
  fallback =
    "Stripe rejected the request."
) {

  return String(
    data?.error?.message ||
    data?.message ||
    fallback
  );
}
