import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

import {
  setActiveEmailProvider
} from "../../../../lib/email-delivery.js";

async function userContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const hash = await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT u.business_id
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
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

export async function onRequestGet({ request, env }) {
  const user = await userContext(request, env);
  if (!user) {
    return Response.json(
      { ok: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  const row = await env.DB
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
    active_provider:
      row?.setting_value || "resend"
  });
}

export async function onRequestPost({ request, env }) {
  const user = await userContext(request, env);
  if (!user) {
    return Response.json(
      { ok: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const provider =
    String(body.provider || "").trim().toLowerCase();

  if (!["resend", "gmail"].includes(provider)) {
    return Response.json(
      { ok: false, error: "Choose Gmail or Resend." },
      { status: 400 }
    );
  }

  await setActiveEmailProvider(
    env,
    user.business_id,
    provider
  );

  return Response.json({
    ok: true,
    active_provider: provider
  });
}
