import {
  readSessionToken,
  hashSessionToken
} from "../../lib/auth.js";


export async function onRequest({
  request,
  env,
  next
}) {

  try {

    const sessionToken =
      readSessionToken(
        request
      );


    if (!sessionToken) {

      return Response.redirect(
        new URL(
          "/auth/login.html",
          request.url
        ).toString(),
        302
      );
    }


    const tokenHash =
      await hashSessionToken(
        sessionToken
      );


    const session =
      await env.DB
        .prepare(`
          SELECT s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
              s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `)
        .bind(
          tokenHash
        )
        .first();


    if (!session) {

      return Response.redirect(
        new URL(
          "/auth/login.html",
          request.url
        ).toString(),
        302
      );
    }


    return Response.redirect(
      new URL(
        "/bookings/",
        request.url
      ).toString(),
      302
    );


  } catch (error) {

    console.error(
      "Dashboard authentication failed:",
      error
    );


    return Response.redirect(
      new URL(
        "/auth/login.html",
        request.url
      ).toString(),
      302
    );
  }
}
