import {
  createSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

import {
  sendBusinessEmail
} from "../../../../lib/email-delivery.js";

const GENERIC_MESSAGE =
  "If an active account exists for that email address, a password reset link has been sent.";

function adminOrigin(request) {
  const requestUrl = new URL(request.url);
  const forwarded = String(
    request.headers.get("X-Eselram-Admin-Origin") || ""
  ).trim();

  if (forwarded) {
    try {
      const candidate = new URL(forwarded);
      if (
        candidate.protocol === "https:" &&
        candidate.hostname.endsWith(".eselram.com")
      ) {
        return candidate.origin;
      }
    } catch {}
  }

  return requestUrl.origin;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return Response.json({
        ok: true,
        message: GENERIC_MESSAGE
      });
    }

    const user = await env.DB
      .prepare(`
        SELECT
          u.id,
          u.business_id,
          u.name,
          u.email,
          u.is_active,
          b.name AS business_name
        FROM users u
        JOIN businesses b
          ON b.id = u.business_id
        WHERE u.email = ? COLLATE NOCASE
          AND u.is_active = 1
        LIMIT 1
      `)
      .bind(email)
      .first();

    if (!user) {
      return Response.json({
        ok: true,
        message: GENERIC_MESSAGE
      });
    }

    const token = createSessionToken();
    const tokenHash = await hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE password_reset_tokens
          SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
          WHERE user_id = ? AND used_at IS NULL
        `)
        .bind(user.id),
      env.DB
        .prepare(`
          INSERT INTO password_reset_tokens (
            id,
            user_id,
            token_hash,
            expires_at,
            user_agent
          )
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          `prt_${crypto.randomUUID()}`,
          user.id,
          tokenHash,
          expiresAt,
          request.headers.get("User-Agent") || null
        )
    ]);

    const resetUrl =
      `${adminOrigin(request)}/auth/reset-password/?token=${encodeURIComponent(token)}`;

    const businessName =
      String(user.business_name || "Eselram").trim();
    const recipientName =
      String(user.name || "").trim();

    const subject =
      `Reset your ${businessName} Eselram password`;

    const text = [
      recipientName ? `Hello ${recipientName},` : "Hello,",
      "",
      "A password reset was requested for your Eselram account.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not request this, you can ignore this email."
    ].join("\n");

    const html = `
      <p>${recipientName ? `Hello ${escapeHtml(recipientName)},` : "Hello,"}</p>
      <p>A password reset was requested for your Eselram account.</p>
      <p>
        <a href="${escapeHtml(resetUrl)}">Reset your password</a>
      </p>
      <p>This link expires in 30 minutes and can only be used once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    try {
      await sendBusinessEmail(
        env,
        user.business_id,
        {
          to: user.email,
          subject,
          html,
          text
        }
      );
    } catch (error) {
      console.error(
        "Password reset email could not be sent:",
        error?.message || error
      );
    }

    return Response.json({
      ok: true,
      message: GENERIC_MESSAGE
    });
  } catch (error) {
    console.error("Password reset request failed:", error);

    // Keep the response generic so the endpoint cannot be used to discover
    // whether a business user exists.
    return Response.json({
      ok: true,
      message: GENERIC_MESSAGE
    });
  }
}
