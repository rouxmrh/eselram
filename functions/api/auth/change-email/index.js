import { readSessionToken, hashSessionToken, createSessionToken } from "../../../../lib/auth.js";
import { sendBusinessEmail } from "../../../../lib/email-delivery.js";

async function currentUser(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  return env.DB.prepare(`
    SELECT u.id AS user_id, u.business_id, u.name, u.email, b.name AS business_name
    FROM user_sessions s
    JOIN users u ON u.id=s.user_id
    JOIN businesses b ON b.id=u.business_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL
      AND datetime(s.expires_at)>datetime('now') AND u.is_active=1
    LIMIT 1
  `).bind(tokenHash).first();
}

function adminOrigin(request) {
  const url = new URL(request.url);
  const forwarded = String(request.headers.get("X-Eselram-Admin-Origin") || "").trim();
  if (forwarded) {
    try {
      const candidate = new URL(forwarded);
      if (candidate.protocol === "https:" && candidate.hostname.endsWith(".eselram.com")) return candidate.origin;
    } catch {}
  }
  return url.origin;
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await currentUser(request, env);
    if (!user) return Response.json({ ok:false, error:"Authentication required." }, { status:401 });

    const body = await request.json().catch(() => ({}));
    const newEmail = String(body.email || "").trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return Response.json({ ok:false, error:"Enter a valid email address." }, { status:400 });
    }
    if (newEmail === String(user.email || "").toLowerCase()) {
      return Response.json({ ok:false, error:"That is already your login email." }, { status:400 });
    }

    const duplicate = await env.DB.prepare(`SELECT id FROM users WHERE business_id=? AND email=? COLLATE NOCASE AND id<>? LIMIT 1`)
      .bind(user.business_id, newEmail, user.user_id).first();
    if (duplicate) return Response.json({ ok:false, error:"That email is already used by another account." }, { status:409 });

    const token = createSessionToken();
    const tokenHash = await hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE login_email_change_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE user_id=? AND used_at IS NULL`).bind(user.user_id),
      env.DB.prepare(`INSERT INTO login_email_change_tokens(id,user_id,new_email,token_hash,expires_at) VALUES(?,?,?,?,?)`)
        .bind(`lect_${crypto.randomUUID()}`, user.user_id, newEmail, tokenHash, expiresAt)
    ]);

    const verifyUrl = `${adminOrigin(request)}/api/auth/change-email/verify?token=${encodeURIComponent(token)}`;
    const name = String(user.name || "").trim();
    const businessName = String(user.business_name || "Eselram").trim();
    const subject = `Verify your new ${businessName} Eselram login email`;
    const text = [name ? `Hello ${name},` : "Hello,", "", "Confirm this email address as your new Eselram login email:", verifyUrl, "", "This link expires in 30 minutes and can only be used once.", "Your current login email will remain unchanged until you verify this address."].join("\n");
    const html = `<p>${name ? `Hello ${escapeHtml(name)},` : "Hello,"}</p><p>Confirm this email address as your new Eselram login email.</p><p><a href="${escapeHtml(verifyUrl)}">Verify new login email</a></p><p>This link expires in 30 minutes and can only be used once.</p><p>Your current login email will remain unchanged until you verify this address.</p>`;
    await sendBusinessEmail(env, user.business_id, { to:newEmail, subject, text, html });
    return Response.json({ ok:true, message:"Verification sent. Your login email will change after you verify the new address." });
  } catch (error) {
    console.error("Login email change request failed:", error);
    return Response.json({ ok:false, error:"Unable to send the verification email. Please try again." }, { status:500 });
  }
}
