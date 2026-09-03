import { readSessionToken, hashSessionToken } from "./auth.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function requireOwner(request, env) {
  const token = readSessionToken(request);
  if (!token) return { response: json({ ok: false, error: "Sign in as the business owner to manage Eselram updates." }, 401) };

  const tokenHash = await hashSessionToken(token);
  const session = await env.DB.prepare(`
    SELECT s.id AS session_id, u.id AS user_id, u.business_id, u.name, u.email
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();

  if (!session) return { response: json({ ok: false, error: "Your session has expired. Sign in again to manage Eselram updates." }, 401) };

  const owner = await env.DB.prepare(`
    SELECT 1 AS allowed
    FROM user_roles
    WHERE user_id = ? AND role_key = 'owner'
    LIMIT 1
  `).bind(session.user_id).first();

  if (!owner?.allowed) return { response: json({ ok: false, error: "Only the business owner can install Eselram updates." }, 403) };
  return { session };
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...signed].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function installedUpdateAssertion(env) {
  const installationId = String(env.ESELRAM_INSTALLATION_ID || "").trim();
  const currentVersion = String(env.ESELRAM_RELEASE_VERSION || "").trim();
  const secret = String(env.ESELRAM_UPDATE_SECRET || "").trim();
  if (!installationId || !currentVersion || !secret) {
    const error = new Error("Secure in-app updates will become available after this installation receives the update handoff configuration.");
    error.status = 409;
    throw error;
  }
  const timestamp = Date.now();
  const nonce = randomNonce();
  const message = [installationId, currentVersion, String(timestamp), nonce].join("\n");
  const signature = await hmacHex(secret, message);
  return { installation_id: installationId, current_version: currentVersion, timestamp, nonce, signature };
}

export function updateBrokerBase(env) {
  return String(env.ESELRAM_OAUTH_BROKER_URL || "https://auth.eselram.com").replace(/\/$/, "");
}

export async function brokerJson(env, path, payload) {
  const response = await fetch(`${updateBrokerBase(env)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `Secure updater request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}
