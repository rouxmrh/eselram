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
  decryptIntegrationSecret
} from "../../../../../lib/integration-crypto.js";

import {
  setActiveEmailProvider
} from "../../../../../lib/email-delivery.js";

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function row(env, businessId) {
  return await env.DB
    .prepare(`
      SELECT
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error
      FROM business_email_connections
      WHERE business_id = ? AND provider = 'gmail'
      LIMIT 1
    `)
    .bind(businessId)
    .first();
}

export async function onRequestGet({ request, env }) {
  const user = await userContext(request, env);
  if (!user) return unauthorized();

  const saved = await row(env, user.business_id);
  let email = "";
  let senderName = user.business_name || "";

  if (saved?.encrypted_credentials) {
    try {
      const credentials = parseJson(
        await decryptIntegrationSecret(
          saved.encrypted_credentials,
          env.ESELRAM_ENCRYPTION_KEY
        ),
        {}
      );
      const config = parseJson(saved.config_json, {});
      email =
        String(config.email || credentials.email || "").trim();
      senderName =
        String(config.sender_name || senderName).trim();
    } catch {}
  }

  const active = await env.DB
    .prepare(`
      SELECT setting_value
      FROM business_settings
      WHERE business_id = ?
        AND setting_key = 'email_active_provider'
      LIMIT 1
    `)
    .bind(user.business_id)
    .first();

  return Response.json({
    ok: true,
    gmail: {
      connected: Boolean(saved?.encrypted_credentials && email),
      email,
      sender_name: senderName,
      status: saved?.status || "not_configured",
      active: active?.setting_value === "gmail",
      last_tested_at: saved?.last_tested_at || null,
      last_error: saved?.last_error || null
    }
  });
}

export async function onRequestPost({ request, env }) {
  const user = await userContext(request, env);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  if (action !== "use") {
    return Response.json(
      { ok: false, error: "Unknown Gmail action." },
      { status: 400 }
    );
  }

  const saved = await row(env, user.business_id);

  if (!saved?.encrypted_credentials) {
    return Response.json(
      { ok: false, error: "Connect Gmail first." },
      { status: 409 }
    );
  }

  await setActiveEmailProvider(
    env,
    user.business_id,
    "gmail"
  );

  return Response.json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const user = await userContext(request, env);
  if (!user) return unauthorized();

  await env.DB
    .prepare(`
      DELETE FROM business_email_connections
      WHERE business_id = ? AND provider = 'gmail'
    `)
    .bind(user.business_id)
    .run();

  const active = await env.DB
    .prepare(`
      SELECT setting_value
      FROM business_settings
      WHERE business_id = ?
        AND setting_key = 'email_active_provider'
      LIMIT 1
    `)
    .bind(user.business_id)
    .first();

  if (active?.setting_value === "gmail") {
    await setActiveEmailProvider(
      env,
      user.business_id,
      "resend"
    );
  }

  return Response.json({ ok: true });
}
