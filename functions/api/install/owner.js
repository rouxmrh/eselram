import {
  hashPassword,
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


    const name =
      String(
        body.name || ""
      ).trim();


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


    if (!name) {

      return Response.json(
        {
          ok: false,
          error:
            "Your name is required."
        },
        {
          status: 400
        }
      );
    }


    if (
      !email ||
      !email.includes("@")
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "A valid email address is required."
        },
        {
          status: 400
        }
      );
    }


    if (
      password.length < 12
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Password must contain at least 12 characters."
        },
        {
          status: 400
        }
      );
    }


    const installation =
      await env.DB
        .prepare(`
          SELECT
            current_step,
            is_complete

          FROM installer_state

          WHERE id = 1
        `)
        .first();


    if (
      installation?.is_complete === 1
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Eselram has already been installed."
        },
        {
          status: 409
        }
      );
    }


    const business =
      await env.DB
        .prepare(`
          SELECT id

          FROM businesses

          LIMIT 1
        `)
        .first();


    if (!business) {

      return Response.json(
        {
          ok: false,
          error:
            "Business setup must be completed first."
        },
        {
          status: 409
        }
      );
    }


    const existingUser =
      await env.DB
        .prepare(`
          SELECT id

          FROM users

          WHERE
            business_id = ?
            AND email = ?

          LIMIT 1
        `)
        .bind(
          business.id,
          email
        )
        .first();


    if (existingUser) {

      return Response.json(
        {
          ok: false,
          error:
            "An account already exists with this email."
        },
        {
          status: 409
        }
      );
    }


    const passwordHash =
      await hashPassword(
        password
      );


    const userId =
      `usr_${crypto.randomUUID()}`;


    await env.DB
      .prepare(`
        INSERT INTO users (
          id,
          business_id,
          name,
          email,
          password_hash,
          role,
          is_active
        )

        VALUES (
          ?, ?, ?, ?, ?, 'owner', 1
        )
      `)
      .bind(
        userId,
        business.id,
        name,
        email,
        passwordHash
      )
      .run();


    await env.DB
      .prepare(`
        INSERT INTO user_roles (
          user_id,
          role_key
        )

        VALUES (
          ?, 'owner'
        )
      `)
      .bind(
        userId
      )
      .run();


    const sessionToken =
      createSessionToken();


    const sessionHash =
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
          ?, ?, ?, ?, CURRENT_TIMESTAMP, ?
        )
      `)
      .bind(
        sessionId,
        userId,
        sessionHash,
        expiresAt,
        request.headers.get(
          "User-Agent"
        ) || null
      )
      .run();


    await env.DB
      .prepare(`
        UPDATE installer_state

        SET
          current_step = 'complete',
          is_complete = 1,
          completed_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = 1
      `)
      .run();


    return Response.json(
      {
        ok: true,

        installation_complete:
          true,

        user: {
          id: userId,
          name,
          email
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
    "Owner installation failed:",
    error
  );

  return Response.json(
    {
      ok: false,
      error: "Unable to create the owner account."
    },
    {
      status: 500
    }
  );

}
}
