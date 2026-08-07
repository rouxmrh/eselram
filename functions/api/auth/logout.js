import {
  readSessionToken,
  hashSessionToken,
  clearSessionCookie
} from "../../../lib/auth.js";


export async function onRequestPost({
  request,
  env
}) {

  try {

    const sessionToken =
      readSessionToken(
        request
      );


    if (sessionToken) {

      const tokenHash =
        await hashSessionToken(
          sessionToken
        );


      await env.DB
        .prepare(`
          UPDATE user_sessions

          SET
            revoked_at =
              CURRENT_TIMESTAMP

          WHERE
            token_hash = ?
            AND revoked_at IS NULL
        `)
        .bind(
          tokenHash
        )
        .run();
    }


    return Response.json(
      {
        ok: true
      },
      {
        headers: {
          "Set-Cookie":
            clearSessionCookie(),

          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (error) {

    console.error(
      "Logout failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to sign out."
      },
      {
        status: 500
      }
    );

  }
}
