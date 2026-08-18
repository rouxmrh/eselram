function createId(prefix = "biz") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const countryCode = String(body.country_code || "GB").trim();
    const timezone = String(body.timezone || "Europe/London").trim();
    const currency = String(body.currency || "GBP").trim();

    if (!name) {
      return Response.json(
        {
          ok: false,
          error: "Business name is required."
        },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return Response.json(
        {
          ok: false,
          error: "A valid business email is required."
        },
        { status: 400 }
      );
    }

    const [
      existingBusiness,
      installation
    ] = await Promise.all([
      env.DB
        .prepare(`
          SELECT id
          FROM businesses
          LIMIT 1
        `)
        .first(),

      env.DB
        .prepare(`
          SELECT current_step, is_complete
          FROM installer_state
          WHERE id = 1
        `)
        .first()
    ]);

    if (
      existingBusiness &&
      installation?.is_complete === 1
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Eselram has already been configured."
        },
        { status: 409 }
      );
    }

    let businessId =
      existingBusiness?.id ||
      createId();

    if (existingBusiness) {
      await env.DB
        .prepare(`
          UPDATE businesses
          SET
            name = ?,
            email = ?,
            phone = ?,
            country_code = ?,
            timezone = ?,
            currency = ?,
            locale = ?
          WHERE id = ?
        `)
        .bind(
          name,
          email,
          phone || null,
          countryCode,
          timezone,
          currency,
          "en-GB",
          businessId
        )
        .run();
    } else {
      await env.DB
        .prepare(`
          INSERT INTO businesses (
            id,
            name,
            email,
            phone,
            country_code,
            timezone,
            currency,
            locale
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          businessId,
          name,
          email,
          phone || null,
          countryCode,
          timezone,
          currency,
          "en-GB"
        )
        .run();
    }

    await env.DB
      .prepare(`
        UPDATE installer_state
        SET
          current_step = 'hours',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `)
      .run();

    return Response.json({
      ok: true,
      business: {
        id: businessId,
        name
      },
      next_step: "hours"
    });

  } catch (error) {
    console.error(
      "Business installer step failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to save business details."
      },
      { status: 500 }
    );
  }
}
