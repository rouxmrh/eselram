import {
  readSessionToken,
  hashSessionToken
} from "../../../../../lib/auth.js";

async function userContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const hash = await hashSessionToken(token);

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
    .bind(hash)
    .first();
}

function unauthorized() {
  return Response.json(
    { ok: false, error: "Authentication required." },
    { status: 401 }
  );
}

import {
  encryptIntegrationSecret
} from "../../../../../lib/integration-crypto.js";

import {
  setActiveEmailProvider
} from "../../../../../lib/email-delivery.js";

const DEFAULT_BROKER =
  "https://auth.eselram.com";

export async function onRequestGet({ request, env }) {
  const user = await userContext(request, env);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const claim =
    String(url.searchParams.get("claim") || "").trim();

  if (!claim) {
    return Response.redirect(
      `${url.origin}/settings/?tab=email&gmail=error`,
      302
    );
  }

  try {
    const broker =
      String(
        env.ESELRAM_OAUTH_BROKER_URL ||
        DEFAULT_BROKER
      ).replace(/\/$/, "");

    const response = await fetch(
      `${broker}/api/gmail/claim`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          claim,
          audience: url.origin
        })
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
        "Unable to complete Gmail authorization."
      );
    }

    const gmail = data.gmail || {};

    const encrypted =
      await encryptIntegrationSecret(
        JSON.stringify({
          access_token:
            gmail.access_token,
          refresh_token:
            gmail.refresh_token,
          expires_at:
            Math.floor(Date.now() / 1000) +
            Number(gmail.expires_in || 3600),
          scope:
            gmail.scope || "",
          email:
            gmail.email || ""
        }),
        env.ESELRAM_ENCRYPTION_KEY
      );

    await env.DB
      .prepare(`
        INSERT INTO business_email_connections (
          id,
          business_id,
          provider,
          encrypted_credentials,
          config_json,
          status
        )
        VALUES (?, ?, 'gmail', ?, ?, 'verified')
        ON CONFLICT(business_id, provider) DO UPDATE SET
          encrypted_credentials = excluded.encrypted_credentials,
          config_json = excluded.config_json,
          status = 'verified',
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        `email_${crypto.randomUUID()}`,
        user.business_id,
        encrypted,
        JSON.stringify({
          email:
            gmail.email || "",
          sender_name:
            user.business_name || ""
        })
      )
      .run();

    await setActiveEmailProvider(
      env,
      user.business_id,
      "gmail"
    );

    return Response.redirect(
      `${url.origin}/settings/?tab=email&gmail=connected`,
      302
    );
  } catch (error) {
    console.error("Gmail OAuth callback failed:", error);

    return Response.redirect(
      `${url.origin}/settings/?tab=email&gmail=error`,
      302
    );
  }
}
