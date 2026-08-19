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

const DEFAULT_BROKER =
  "https://eselram-provisioner.mroschhaden.workers.dev";

export async function onRequestGet({ request, env }) {
  const user = await userContext(request, env);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const callback =
    `${url.origin}/api/integrations/email/gmail/callback`;

  const broker =
    String(
      env.ESELRAM_OAUTH_BROKER_URL ||
      DEFAULT_BROKER
    ).replace(/\/$/, "");

  const target =
    `${broker}/api/gmail/start?return_url=${encodeURIComponent(callback)}`;

  return Response.redirect(target, 302);
}
