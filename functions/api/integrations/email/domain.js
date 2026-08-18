import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

import {
  decryptIntegrationSecret
} from "../../../../lib/integration-crypto.js";

const RESEND_API = "https://api.resend.com";

async function getUserContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;

  const tokenHash = await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN businesses b ON b.id = u.business_id
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
    { ok: false, error: "Authentication required." },
    { status: 401 }
  );
}

function badRequest(error) {
  return Response.json({ ok: false, error }, { status: 400 });
}

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normaliseDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function validDomain(value) {
  return /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
    value
  );
}

async function getIntegration(env, businessId) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        encrypted_credentials,
        config_json,
        status
      FROM business_integrations
      WHERE business_id = ?
        AND integration_type = 'email'
        AND provider = 'resend'
      LIMIT 1
    `)
    .bind(businessId)
    .first();
}

async function resendRequest(apiKey, path, options = {}) {
  const response = await fetch(`${RESEND_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Resend request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function credentialsFor(env, integration) {
  if (!integration?.encrypted_credentials) return {};

  return JSON.parse(
    await decryptIntegrationSecret(
      integration.encrypted_credentials,
      env.ESELRAM_ENCRYPTION_KEY
    )
  );
}

async function saveConfig(env, businessId, config, status = null) {
  await env.DB
    .prepare(`
      UPDATE business_integrations
      SET
        config_json = ?,
        status = COALESCE(?, status),
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE business_id = ?
        AND integration_type = 'email'
        AND provider = 'resend'
    `)
    .bind(JSON.stringify(config), status, businessId)
    .run();
}

function domainResponse(config, domain = null, automationAvailable = false) {
  const domainName =
    domain?.name ||
    config.sending_domain_name ||
    "";

  const status =
    domain?.status ||
    config.sending_domain_status ||
    "not_configured";

  const records =
    domain?.records ||
    config.sending_domain_records ||
    [];

  return {
    configured: Boolean(domainName),
    automation_available: automationAvailable,
    domain_id:
      domain?.id ||
      config.sending_domain_id ||
      null,
    domain_name: domainName,
    domain_status: status,
    records,
    verified: status === "verified",
    suggested_sending_email:
      status === "verified" && domainName
        ? `notifications@${domainName}`
        : ""
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const integration = await getIntegration(env, user.business_id);

    if (!integration) {
      return Response.json({
        ok: true,
        domain: domainResponse({}, null, false)
      });
    }

    const config = parseJson(integration.config_json, {});
    const credentials =
      await credentialsFor(env, integration).catch(() => ({}));

    const managementKey =
      String(credentials.management_api_key || "").trim();

    let domain = null;

    if (managementKey && config.sending_domain_id) {
      try {
        domain = await resendRequest(
          managementKey,
          `/domains/${encodeURIComponent(config.sending_domain_id)}`
        );

        config.sending_domain_status =
          domain?.status || config.sending_domain_status;

        config.sending_domain_records =
          domain?.records ||
          config.sending_domain_records ||
          [];

        if (
          domain?.status === "verified" &&
          domain?.name &&
          !config.from_email
        ) {
          config.from_email =
            `notifications@${domain.name}`;
        }

        await saveConfig(
          env,
          user.business_id,
          config
        );
      } catch (error) {
        console.error(
          "Unable to refresh Resend domain:",
          error
        );
      }
    }

    return Response.json({
      ok: true,
      domain:
        domainResponse(
          config,
          domain,
          Boolean(managementKey)
        )
    });

  } catch (error) {
    console.error(
      "Email domain GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load the sending-domain setup."
      },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const integration =
      await getIntegration(
        env,
        user.business_id
      );

    if (!integration) {
      return badRequest(
        "Connect Resend before setting up a sending domain."
      );
    }

    const credentials =
      await credentialsFor(
        env,
        integration
      );

    const managementKey =
      String(
        credentials.management_api_key ||
        ""
      ).trim();

    if (!managementKey) {
      return Response.json(
        {
          ok: false,
          error:
            "This existing installation does not yet have the guided-domain credential. Add and verify the domain in Resend manually for this test installation. New installations created after the provisioner update can complete the full domain setup inside Eselram."
        },
        { status: 409 }
      );
    }

    const config =
      parseJson(
        integration.config_json,
        {}
      );

    const body =
      await request.json().catch(
        () => ({})
      );

    const action =
      String(
        body.action || ""
      ).trim();

    if (action === "create") {
      const domainName =
        normaliseDomain(
          body.domain
        );

      if (!validDomain(domainName)) {
        return badRequest(
          "Enter a domain you own, for example yourclinic.co.uk."
        );
      }

      let domain;

      try {
        domain =
          await resendRequest(
            managementKey,
            "/domains",
            {
              method: "POST",
              body:
                JSON.stringify({
                  name: domainName
                })
            }
          );
      } catch (error) {
        // Reuse an existing domain in the same buyer-owned Resend account.
        const list =
          await resendRequest(
            managementKey,
            "/domains"
          ).catch(() => null);

        const existing =
          Array.isArray(list?.data)
            ? list.data.find(
                item =>
                  String(
                    item?.name || ""
                  ).toLowerCase() ===
                  domainName
              )
            : null;

        if (!existing) {
          throw error;
        }

        domain =
          await resendRequest(
            managementKey,
            `/domains/${encodeURIComponent(existing.id)}`
          );
      }

      config.sending_domain_id =
        domain.id;

      config.sending_domain_name =
        domain.name ||
        domainName;

      config.sending_domain_status =
        domain.status ||
        "pending";

      config.sending_domain_records =
        domain.records ||
        [];

      config.from_email =
        domain.status === "verified"
          ? `notifications@${domain.name || domainName}`
          : "";

      await saveConfig(
        env,
        user.business_id,
        config,
        "configured"
      );

      return Response.json({
        ok: true,
        domain:
          domainResponse(
            config,
            domain,
            true
          )
      });
    }

    if (action === "verify") {
      const domainId =
        String(
          body.domain_id ||
          config.sending_domain_id ||
          ""
        ).trim();

      if (!domainId) {
        return badRequest(
          "Set up a sending domain first."
        );
      }

      await resendRequest(
        managementKey,
        `/domains/${encodeURIComponent(domainId)}/verify`,
        { method: "POST" }
      );

      const domain =
        await resendRequest(
          managementKey,
          `/domains/${encodeURIComponent(domainId)}`
        );

      config.sending_domain_id =
        domain.id ||
        domainId;

      config.sending_domain_name =
        domain.name ||
        config.sending_domain_name ||
        "";

      config.sending_domain_status =
        domain.status ||
        "pending";

      config.sending_domain_records =
        domain.records ||
        config.sending_domain_records ||
        [];

      if (
        config.sending_domain_status ===
          "verified" &&
        config.sending_domain_name
      ) {
        config.from_email =
          config.from_email ||
          `notifications@${config.sending_domain_name}`;
      }

      await saveConfig(
        env,
        user.business_id,
        config,
        "configured"
      );

      return Response.json({
        ok: true,
        domain:
          domainResponse(
            config,
            domain,
            true
          )
      });
    }

    return badRequest(
      "Unknown domain setup action."
    );

  } catch (error) {
    console.error(
      "Resend domain setup failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to update the Resend sending domain."
      },
      {
        status:
          error?.status &&
          error.status < 500
            ? error.status
            : 500
      }
    );
  }
}
