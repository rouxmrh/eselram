import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

import {
  encryptIntegrationSecret,
  decryptIntegrationSecret
} from "../../../../lib/integration-crypto.js";

import {
  sendBusinessEmail
} from "../../../../lib/email-delivery.js";

async function getUserContext(request, env) {
  const token = readSessionToken(request);

  if (!token) return null;

  const tokenHash =
    await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      JOIN businesses b
        ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
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

function badRequest(message) {
  return Response.json(
    {
      ok: false,
      error: message
    },
    {
      status: 400
    }
  );
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normaliseEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "icloud.com", "me.com", "yahoo.com", "yahoo.co.uk", "aol.com",
  "proton.me", "protonmail.com"
]);

function emailDomain(value) {
  const email = normaliseEmail(value);
  return email.includes("@") ? email.split("@").pop() : "";
}

function isPersonalSendingAddress(value) {
  return PERSONAL_EMAIL_DOMAINS.has(emailDomain(value));
}

function looksLikeEmail(value) {
  return String(value || "").includes("@");
}

function looksLikePlaceholderSender(value) {
  const email = normaliseEmail(value);
  return (
    !email ||
    email.endsWith("@myclinic.co.uk") ||
    email.endsWith("@example.com") ||
    email.endsWith("@example.co.uk") ||
    isPersonalSendingAddress(email)
  );
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
        AND integration_type = 'email'
      LIMIT 1
    `)
    .bind(businessId)
    .first();
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

    const integration =
      await getIntegration(
        env,
        user.business_id
      );

    if (!integration) {
      return Response.json({
        ok: true,
        integration: {
          provider: "resend",
          status: "not_configured",
          has_api_key: false,
          from_name: "",
          from_email: "",
          last_tested_at: null,
          last_error: null,
          business_name: user.business_name || "",
          business_contact_email: user.business_email || ""
        },
        encryption_ready:
          Boolean(
            String(
              env.ESELRAM_ENCRYPTION_KEY || ""
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
          integration.provider,
        status:
          integration.status,
        has_api_key:
          Boolean(
            integration.encrypted_credentials
          ),
        from_name:
          (
            !config.from_name ||
            looksLikeEmail(config.from_name) ||
            String(config.from_name).trim().toLowerCase() === "my clinic"
          )
            ? (user.business_name || "")
            : config.from_name,
        from_email:
          looksLikePlaceholderSender(config.from_email)
            ? ""
            : (config.from_email || ""),
        business_name:
          user.business_name || "",
        business_contact_email:
          user.business_email || "",
        sender_domain_required:
          !config.from_email ||
          looksLikePlaceholderSender(config.from_email),
        sending_domain_id:
          config.sending_domain_id || null,
        sending_domain_name:
          config.sending_domain_name || "",
        sending_domain_status:
          config.sending_domain_status || "not_configured",
        last_tested_at:
          integration.last_tested_at,
        last_error:
          looksLikePlaceholderSender(config.from_email)
            ? null
            : integration.last_error
      },
      encryption_ready:
        Boolean(
          String(
            env.ESELRAM_ENCRYPTION_KEY || ""
          ).trim()
        )
    });
  } catch (error) {
    console.error(
      "Email integration GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load email integration."
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

    if (
      !String(
        env.ESELRAM_ENCRYPTION_KEY || ""
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

    const provider =
      String(
        body.provider || "resend"
      )
        .trim()
        .toLowerCase();

    if (provider !== "resend") {
      return badRequest(
        "Resend is currently the supported email provider."
      );
    }

    const fromName =
      String(
        body.from_name || ""
      ).trim();

    const fromEmail =
      normaliseEmail(
        body.from_email
      );

    const apiKey =
      String(
        body.api_key || ""
      ).trim();

    if (!fromName) {
      return badRequest(
        "From name is required."
      );
    }

    if (
      fromEmail &&
      !isValidEmail(fromEmail)
    ) {
      return badRequest(
        "Enter a valid sending email address, or leave it blank until your sending domain is ready."
      );
    }

    if (fromEmail && isPersonalSendingAddress(fromEmail)) {
      return badRequest(
        "Gmail, Outlook and other personal email addresses can be your business contact/reply address, but Resend cannot use them as the sending address. Use an address on a domain you have verified in Resend, or leave Sending email blank for now."
      );
    }

    const existing =
      await getIntegration(
        env,
        user.business_id
      );

    let encryptedCredentials =
      existing?.encrypted_credentials ||
      null;

    if (apiKey) {
      if (!apiKey.startsWith("re_")) {
        return badRequest(
          "The Resend API key does not look valid."
        );
      }

      encryptedCredentials =
        await encryptIntegrationSecret(
          JSON.stringify({
            api_key: apiKey
          }),
          env.ESELRAM_ENCRYPTION_KEY
        );
    }

    if (!encryptedCredentials) {
      return badRequest(
        "A Resend API key is required."
      );
    }

    const existingConfig =
      parseJson(
        existing?.config_json,
        {}
      );

    const configJson =
      JSON.stringify({
        ...existingConfig,
        from_name: fromName,
        from_email: fromEmail
      });

    if (existing) {
      await env.DB
        .prepare(`
          UPDATE business_integrations
          SET
            provider = 'resend',
            encrypted_credentials = ?,
            config_json = ?,
            status = 'configured',
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            business_id = ?
            AND integration_type = 'email'
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
            'email',
            'resend',
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

    return Response.json({
      ok: true,
      integration: {
        provider: "resend",
        status: "configured",
        has_api_key: true,
        from_name: fromName,
        from_email: fromEmail
      }
    });
  } catch (error) {
    console.error(
      "Email integration PUT failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to save email integration."
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
      String(body.action || "").trim() !== "test"
    ) {
      return badRequest(
        "Invalid email integration action."
      );
    }

    const testEmail =
      normaliseEmail(
        body.test_email
      );

    if (
      !testEmail ||
      !isValidEmail(testEmail)
    ) {
      return badRequest(
        "Enter a valid email address for the test."
      );
    }

    const result =
      await sendBusinessEmail(
        env,
        user.business_id,
        {
          to:
            testEmail,
          subject:
            "Eselram email connection test",
          html:
            "<p>Your Eselram email connection is working.</p><p>This message was sent using the email provider selected in Eselram.</p>",
          text:
            "Your Eselram email connection is working. This message was sent using the email provider selected in Eselram."
        }
      );

    if (result.provider === "resend") {
      await env.DB
        .prepare(`
          UPDATE business_integrations
          SET
            status = 'verified',
            last_tested_at = CURRENT_TIMESTAMP,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE business_id = ?
            AND integration_type = 'email'
            AND provider = 'resend'
        `)
        .bind(user.business_id)
        .run();
    } else if (result.provider === "gmail") {
      await env.DB
        .prepare(`
          UPDATE business_email_connections
          SET
            status = 'verified',
            last_tested_at = CURRENT_TIMESTAMP,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE business_id = ?
            AND provider = 'gmail'
        `)
        .bind(user.business_id)
        .run();
    }

    return Response.json({
      ok: true,
      message:
        `Test email sent to ${testEmail} using ${result.provider === "gmail" ? "Gmail" : "Resend"}.`,
      provider:
        result.provider,
      provider_id:
        result.id || null
    });
  } catch (error) {
    console.error(
      "Email integration test failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to test email integration."
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
          AND integration_type = 'email'
      `)
      .bind(
        user.business_id
      )
      .run();

    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error(
      "Email integration DELETE failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to disconnect email integration."
      },
      {
        status: 500
      }
    );
  }
}
