import { encryptIntegrationSecret } from "../../../../../../lib/integration-crypto.js";

function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(secret || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...signed].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createWebhook(accessToken, origin, businessId, installationId) {
  const params = new URLSearchParams();
  params.set("url", `${origin}/api/payments/stripe/webhook?business_id=${encodeURIComponent(businessId)}`);
  for (const event of ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "refund.created", "refund.updated", "refund.failed"]) params.append("enabled_events[]", event);
  params.set("description", "Eselram payment events");
  const response = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `eselram-settings-webhook-${String(installationId).slice(0, 100)}` },
    body: params
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id || !data?.secret) throw new Error(data?.error?.message || "Stripe webhook setup failed.");
  return data;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const installationId = String(body.installation_id || "").trim();
    const expectedInstallationId = String(env.ESELRAM_INSTALLATION_ID || "").trim();
    const timestamp = Number(body.timestamp || 0);
    const accessToken = String(body.access_token || "").trim();
    const stripeUserId = String(body.stripe_user_id || "").trim();
    const publishableKey = String(body.publishable_key || "").trim();
    const livemode = body.livemode === true;
    const signature = String(body.signature || "").trim().toLowerCase();
    const secret = String(env.ESELRAM_UPDATE_HANDOFF_SECRET || env.ESELRAM_UPDATE_SECRET || "").trim();
    if (!installationId || installationId !== expectedInstallationId || !accessToken || !secret || !/^[a-f0-9]{64}$/.test(signature)) return Response.json({ ok: false, error: "Invalid Stripe connection handoff." }, { status: 401 });
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return Response.json({ ok: false, error: "Stripe connection handoff expired." }, { status: 401 });
    const message = [installationId, String(timestamp), stripeUserId, accessToken, publishableKey, livemode ? "1" : "0"].join("\n");
    const expected = await hmacHex(secret, message);
    if (!safeEqual(expected, signature)) return Response.json({ ok: false, error: "Stripe connection handoff could not be verified." }, { status: 401 });

    const business = await env.DB.prepare("SELECT id, currency FROM businesses ORDER BY created_at ASC LIMIT 1").first();
    if (!business?.id) throw new Error("Business setup is incomplete.");

    const balanceResponse = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${accessToken}` } });
    const balance = await balanceResponse.json().catch(() => ({}));
    if (!balanceResponse.ok) throw new Error(balance?.error?.message || "Stripe could not verify the connected account.");
    const mode = balance?.livemode === true || livemode || accessToken.includes("_live_") ? "live" : "sandbox";
    const currency = String(balance?.available?.[0]?.currency || business.currency || "GBP").toUpperCase();
    const origin = new URL(request.url).origin;
    const webhook = await createWebhook(accessToken, origin, business.id, installationId);

    const encrypted = await encryptIntegrationSecret(JSON.stringify({ secret_key: accessToken, webhook_secret: webhook.secret, credential_source: "stripe_connect_oauth" }), String(env.ESELRAM_ENCRYPTION_KEY || ""));
    const config = JSON.stringify({ publishable_key: publishableKey, currency, mode, has_webhook_secret: true, webhook_endpoint_id: webhook.id, webhook_url: webhook.url || `${origin}/api/payments/stripe/webhook?business_id=${encodeURIComponent(business.id)}`, connected_account_id: stripeUserId || null, connected_via: "provisioner", verified_during_installation: false, connected_from_settings: true });

    await env.DB.prepare(`INSERT INTO business_integrations (id, business_id, integration_type, provider, encrypted_credentials, config_json, status, last_tested_at, last_error)
      VALUES (?, ?, 'payments', 'stripe', ?, ?, 'verified', CURRENT_TIMESTAMP, NULL)
      ON CONFLICT(business_id, integration_type) DO UPDATE SET provider='stripe', encrypted_credentials=excluded.encrypted_credentials, config_json=excluded.config_json, status='verified', last_tested_at=CURRENT_TIMESTAMP, last_error=NULL, updated_at=CURRENT_TIMESTAMP`)
      .bind(`bi_${crypto.randomUUID()}`, business.id, encrypted, config).run();

    const existing = await env.DB.prepare("SELECT is_default FROM business_payment_providers WHERE business_id=? AND provider_key='stripe' LIMIT 1").bind(business.id).first();
    if (existing) {
      await env.DB.prepare("UPDATE business_payment_providers SET is_enabled=1, connection_status='connected', environment=?, external_account_reference=?, webhook_status='configured', last_sync_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE business_id=? AND provider_key='stripe'")
        .bind(mode, stripeUserId || null, business.id).run();
    } else {
      await env.DB.prepare("INSERT INTO business_payment_providers (id,business_id,provider_key,is_enabled,is_default,connection_status,environment,external_account_reference,webhook_status,last_sync_at) VALUES (?,?,'stripe',1,0,'connected',?,?, 'configured',CURRENT_TIMESTAMP)")
        .bind(`payprov_${crypto.randomUUID()}`, business.id, mode, stripeUserId || null).run();
    }

    return Response.json({ ok: true, mode, connected_account_id: stripeUserId || null });
  } catch (error) {
    console.error("Stripe settings OAuth completion failed:", error);
    return Response.json({ ok: false, error: error?.message || "Unable to save Stripe connection." }, { status: 500 });
  }
}
