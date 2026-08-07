import {
  readSessionToken,
  hashSessionToken
} from "../../lib/auth.js";


async function getUserContext(
  request,
  env
) {

  const token =
    readSessionToken(request);

  if (!token) {
    return null;
  }


  const tokenHash =
    await hashSessionToken(token);


  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}


function unauthorized() {

  return Response.json(
    {
      ok: false,
      error:
        "Authentication required."
    },
    {
      status: 401
    }
  );
}


export async function onRequestGet({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const business =
      await env.DB
        .prepare(`
          SELECT
            id,
            name,
            legal_name,
            email,
            phone,
            website,
            country_code,
            timezone,
            currency,
            locale

          FROM businesses

          WHERE id = ?

          LIMIT 1
        `)
        .bind(
          user.business_id
        )
        .first();


    return Response.json({
      ok: true,
      business
    });


  } catch (error) {

    console.error(
      "Settings GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load settings."
      },
      {
        status: 500
      }
    );
  }
}


export async function onRequestPut({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const body =
      await request.json();


    const name =
      String(
        body.name || ""
      ).trim();


    const legalName =
      String(
        body.legal_name || ""
      ).trim();


    const email =
      String(
        body.email || ""
      ).trim();


    const phone =
      String(
        body.phone || ""
      ).trim();


    const website =
      String(
        body.website || ""
      ).trim();


    const countryCode =
      String(
        body.country_code || "GB"
      ).trim();


    const timezone =
      String(
        body.timezone ||
        "Europe/London"
      ).trim();


    const currency =
      String(
        body.currency || "GBP"
      ).trim();


    const locale =
      String(
        body.locale || "en-GB"
      ).trim();


    if (!name) {

      return Response.json(
        {
          ok: false,
          error:
            "Business name is required."
        },
        {
          status: 400
        }
      );
    }


    await env.DB
      .prepare(`
        UPDATE businesses

        SET
          name = ?,
          legal_name = ?,
          email = ?,
          phone = ?,
          website = ?,
          country_code = ?,
          timezone = ?,
          currency = ?,
          locale = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `)
      .bind(
        name,
        legalName || null,
        email || null,
        phone || null,
        website || null,
        countryCode,
        timezone,
        currency,
        locale,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Settings update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to save settings."
      },
      {
        status: 500
      }
    );
  }
}
