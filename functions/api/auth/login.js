import {
  verifyPassword,
  createSessionToken,
  hashSessionToken,
  createSessionCookie
} from "../../../lib/auth.js";


export async function onRequestPost({
  request,
  env
}) {

  try {

    const body =
      await request.json();


    const email =
      String(
        body.email || ""
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        body.password || ""
      );


    if (
      !email ||
      !password
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Email and password are required."
        },
        {
          status: 400
        }
      );
    }


    const user =
      await env.DB
        .prepare(`
          SELECT
            id,
            business_id,
            name,
            email,
            password_hash,
            is_active

          FROM users

          WHERE email = ?

          LIMIT 1
        `)
        .bind(
          email
        )
        .first();


    if (
      !user ||
      user.is_active !== 1
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid email or password."
        },
        {
          status: 401
        }
      );
    }


    const passwordValid =
      await verifyPassword(
        password,
        user.password_hash
      );


    if (!passwordValid) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid email or password."
        },
        {
          status: 401
        }
      );
    }


    const sessionToken =
      createSessionToken();


    const tokenHash =
      await hashSessionToken(
        sessionToken
      );


    const sessionId =
      `ses_${crypto.randomUUID()}`;


    const expiresAt =
      new Date(
        Date.now() +
        7 * 24 * 60 * 60 * 1000
      ).toISOString();


    await env.DB
      .prepare(`
        INSERT INTO user_sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          last_seen_at,
          user_agent
        )

        VALUES (
          ?, ?, ?, ?,
          CURRENT_TIMESTAMP,
          ?
        )
      `)
      .bind(
        sessionId,
        user.id,
        tokenHash,
        expiresAt,
        request.headers.get(
          "User-Agent"
        ) || null
      )
      .run();


    await env.DB
      .prepare(`
        UPDATE users

        SET
          last_login_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `)
      .bind(
        user.id
      )
      .run();


    return Response.json(
      {
        ok: true,

        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      },
      {
        headers: {
          "Set-Cookie":
            createSessionCookie(
              sessionToken
            ),

          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (error) {

    console.error(
      "Login failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to sign in."
      },
      {
        status: 500
      }
    );

  }
}
