export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const primaryColour =
      String(body.primary_colour || "").trim();

    const accentColour =
      String(body.accent_colour || "").trim();

    const theme =
      String(body.theme || "light").trim();

    const timeFormat =
      String(body.time_format || "24").trim();

    const dateFormat =
      String(body.date_format || "DD/MM/YYYY").trim();

    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    if (
      !hexPattern.test(primaryColour) ||
      !hexPattern.test(accentColour)
    ) {
      return Response.json(
        {
          ok: false,
          error: "Invalid colour value."
        },
        { status: 400 }
      );
    }

    if (!["light", "dark", "system"].includes(theme)) {
      return Response.json(
        {
          ok: false,
          error: "Invalid theme."
        },
        { status: 400 }
      );
    }

    if (!["12", "24"].includes(timeFormat)) {
      return Response.json(
        {
          ok: false,
          error: "Invalid time format."
        },
        { status: 400 }
      );
    }

    if (
      ![
        "DD/MM/YYYY",
        "MM/DD/YYYY",
        "YYYY-MM-DD"
      ].includes(dateFormat)
    ) {
      return Response.json(
        {
          ok: false,
          error: "Invalid date format."
        },
        { status: 400 }
      );
    }

    const business = await env.DB
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
          error: "Business setup must be completed first."
        },
        { status: 409 }
      );
    }

    const settings = [
      ["branding.primary_colour", primaryColour],
      ["branding.accent_colour", accentColour],
      ["branding.theme", theme],
      ["display.time_format", timeFormat],
      ["display.date_format", dateFormat]
    ];

    for (const [key, value] of settings) {
      await env.DB
        .prepare(`
          INSERT INTO business_settings (
            id,
            business_id,
            setting_key,
            setting_value,
            value_type
          )
          VALUES (?, ?, ?, ?, 'string')

          ON CONFLICT(business_id, setting_key)
          DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          `set_${crypto.randomUUID()}`,
          business.id,
          key,
          value
        )
        .run();
    }

    await env.DB
      .prepare(`
        UPDATE installer_state
        SET
          current_step = 'payments',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `)
      .run();

    return Response.json({
      ok: true,
      next_step: "payments"
    });

  } catch (error) {
    console.error(
      "Branding installer step failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to save branding preferences."
      },
      { status: 500 }
    );
  }
}
