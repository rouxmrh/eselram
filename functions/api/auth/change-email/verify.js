import { hashSessionToken } from "../../../../lib/auth.js";

function redirect(request, status) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/settings/?account_email=${encodeURIComponent(status)}#account`, 302);
}

export async function onRequestGet({ request, env }) {
  try {
    const token = String(new URL(request.url).searchParams.get("token") || "").trim();
    if (!token) return redirect(request, "email-invalid");
    const tokenHash = await hashSessionToken(token);
    const change = await env.DB.prepare(`
      SELECT t.id,t.user_id,t.new_email,u.business_id
      FROM login_email_change_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=? AND t.used_at IS NULL AND datetime(t.expires_at)>datetime('now') AND u.is_active=1 LIMIT 1
    `).bind(tokenHash).first();
    if (!change) return redirect(request, "email-invalid");

    const duplicate = await env.DB.prepare(`SELECT id FROM users WHERE business_id=? AND email=? COLLATE NOCASE AND id<>? LIMIT 1`)
      .bind(change.business_id, change.new_email, change.user_id).first();
    if (duplicate) return redirect(request, "email-conflict");

    const consumed = await env.DB.prepare(`UPDATE login_email_change_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL AND datetime(expires_at)>datetime('now')`)
      .bind(change.id).run();
    if (Number(consumed?.meta?.changes || 0) !== 1) return redirect(request, "email-invalid");

    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(change.new_email, change.user_id),
      env.DB.prepare(`UPDATE password_reset_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE user_id=? AND used_at IS NULL`).bind(change.user_id),
      env.DB.prepare(`UPDATE login_email_change_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE user_id=? AND id<>? AND used_at IS NULL`).bind(change.user_id, change.id)
    ]);
    return redirect(request, "email-updated");
  } catch (error) {
    console.error("Login email verification failed:", error);
    return redirect(request, "email-invalid");
  }
}
