import { readSessionToken, hashSessionToken } from "../../../lib/auth.js";
import { getPaymentVouchers, savePaymentVouchers } from "../../../lib/payment-discounts.js";

async function getUserContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  return await env.DB.prepare(`
    SELECT u.business_id
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();
}

function unauthorized() {
  return Response.json({ ok:false, error:"Authentication required." }, { status:401 });
}

export async function onRequestGet({ request, env }) {
  const user = await getUserContext(request, env);
  if (!user) return unauthorized();
  return Response.json({ ok:true, vouchers: await getPaymentVouchers(env, user.business_id) });
}

export async function onRequestPut({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();
    const body = await request.json();
    const vouchers = await savePaymentVouchers(env, user.business_id, body.vouchers || []);
    return Response.json({ ok:true, vouchers });
  } catch (error) {
    return Response.json({ ok:false, error:error.message || "Unable to save vouchers." }, { status:400 });
  }
}
