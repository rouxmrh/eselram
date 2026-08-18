import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";


export async function onRequestGet({
  request,
  env
}) {

  try {

    const sessionToken =
      readSessionToken(
        request
      );


    if (!sessionToken) {

      return Response.json(
        {
          ok: true,
          authenticated: false
        },
        {
          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    const tokenHash =
      await hashSessionToken(
        sessionToken
      );


    const session =
      await env.DB
        .prepare(`
          SELECT
            s.id AS session_id,
            s.expires_at,
            s.revoked_at,

            u.id AS user_id,
            u.name,
            u.email,
            u.business_id

          FROM user_sessions s

          JOIN users u
            ON u.id = s.user_id

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

      return Response.json(
        {
          ok: true,
          authenticated: false
        },
        {
          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    const roles =
      await env.DB
        .prepare(`
          SELECT role_key

          FROM user_roles

          WHERE user_id = ?
        `)
        .bind(
          session.user_id
        )
        .all();


    return Response.json(
      {
        ok: true,
        authenticated: true,

        user: {
          id:
            session.user_id,

          name:
            session.name,

          email:
            session.email,

          business_id:
            session.business_id,

          roles:
            roles.results.map(
              (row) =>
                row.role_key
            )
        }
      },
      {
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (error) {

    console.error(
      "Session check failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        authenticated: false,
        error:
          "Unable to verify session."
      },
      {
        status: 500
      }
    );

  }
}
