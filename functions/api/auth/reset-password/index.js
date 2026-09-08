import {
  hashPassword,
  hashSessionToken
} from "../../../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token) {
      return Response.json(
        { ok: false, error: "This password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return Response.json(
        { ok: false, error: "Password must contain at least 12 characters." },
        { status: 400 }
      );
    }

    const tokenHash = await hashSessionToken(token);
    const reset = await env.DB
      .prepare(`
        SELECT
          prt.id,
          prt.user_id
        FROM password_reset_tokens prt
        JOIN users u
          ON u.id = prt.user_id
        WHERE prt.token_hash = ?
          AND prt.used_at IS NULL
          AND datetime(prt.expires_at) > datetime('now')
          AND u.is_active = 1
        LIMIT 1
      `)
      .bind(tokenHash)
      .first();

    if (!reset) {
      return Response.json(
        { ok: false, error: "This password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const consumeResult = await env.DB
      .prepare(`
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND used_at IS NULL
          AND datetime(expires_at) > datetime('now')
      `)
      .bind(reset.id)
      .run();

    if (Number(consumeResult?.meta?.changes || 0) !== 1) {
      return Response.json(
        { ok: false, error: "This password reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE users
          SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(passwordHash, reset.user_id),
      env.DB
        .prepare(`
          UPDATE user_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
          WHERE user_id = ? AND revoked_at IS NULL
        `)
        .bind(reset.user_id),
      env.DB
        .prepare(`
          UPDATE password_reset_tokens
          SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
          WHERE user_id = ? AND id <> ? AND used_at IS NULL
        `)
        .bind(reset.user_id, reset.id)
    ]);

    return Response.json({
      ok: true,
      message: "Your password has been reset. You can now sign in with your new password."
    });
  } catch (error) {
    console.error("Password reset failed:", error);

    return Response.json(
      { ok: false, error: "Unable to reset your password. Please request a new reset link." },
      { status: 500 }
    );
  }
}
