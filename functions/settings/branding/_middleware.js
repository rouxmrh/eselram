import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

export async function onRequest({ request, env, next }) {
  try {
    const token = readSessionToken(request);

    if (!token) {
      return Response.redirect(
        new URL("/auth/login.html", request.url).toString(),
        302
      );
    }

    const tokenHash = await hashSessionToken(token);

    const session = await env.DB
      .prepare(`
        SELECT s.id
        FROM user_sessions s
        JOIN users u
          ON u.id = s.user_id
        WHERE
          s.token_hash = ?
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) > datetime('now')
          AND u.is_active = 1
        LIMIT 1
      `)
      .bind(tokenHash)
      .first();

    if (!session) {
      return Response.redirect(
        new URL("/auth/login.html", request.url).toString(),
        302
      );
    }

    return next();
  } catch (error) {
    console.error("Branding page authentication failed:", error);

    return Response.redirect(
      new URL("/auth/login.html", request.url).toString(),
      302
    );
  }
}
