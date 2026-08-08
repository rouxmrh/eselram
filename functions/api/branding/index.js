import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

async function getUserContext(request, env) {
  const token = readSessionToken(request);

  if (!token) return null;

  const tokenHash = await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.name AS business_name
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      JOIN businesses b
        ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}

function unauthorized() {
  return Response.json(
    { ok: false, error: "Authentication required." },
    { status: 401 }
  );
}

function badRequest(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 400 }
  );
}

function validColour(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim());
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) return unauthorized();

    const branding = await env.DB
      .prepare(`
        SELECT
          logo_data_url,
          primary_colour,
          accent_colour,
          background_colour,
          surface_colour,
          text_colour,
          form_style,
          logo_position,
          show_business_name,
          show_contact_details,
          footer_text
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `)
      .bind(user.business_id)
      .first();

    return Response.json({
      ok: true,
      business: {
        id: user.business_id,
        name: user.business_name
      },
      branding: branding || {
        logo_data_url: null,
        primary_colour: "#365c50",
        accent_colour: "#6f8079",
        background_colour: "#f5f4ef",
        surface_colour: "#ffffff",
        text_colour: "#18221f",
        form_style: "soft",
        logo_position: "centre",
        show_business_name: 1,
        show_contact_details: 1,
        footer_text: null
      }
    });
  } catch (error) {
    console.error("Branding GET failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load branding." },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) return unauthorized();

    const body = await request.json();

    const colours = [
      body.primary_colour,
      body.accent_colour,
      body.background_colour,
      body.surface_colour,
      body.text_colour
    ];

    if (!colours.every(validColour)) {
      return badRequest("All colours must use a six-digit hex value.");
    }

    const formStyle = String(body.form_style || "soft");
    const logoPosition = String(body.logo_position || "centre");

    if (!["light", "soft", "minimal", "dark"].includes(formStyle)) {
      return badRequest("Invalid form style.");
    }

    if (!["left", "centre"].includes(logoPosition)) {
      return badRequest("Invalid logo position.");
    }

    const logoDataUrl =
      body.logo_data_url === null || body.logo_data_url === ""
        ? null
        : String(body.logo_data_url);

    if (logoDataUrl && !/^data:image\/(png|jpeg|webp);base64,/i.test(logoDataUrl)) {
      return badRequest("Invalid logo format.");
    }

    if (logoDataUrl && logoDataUrl.length > 360000) {
      return badRequest("Logo is too large.");
    }

    await env.DB
      .prepare(`
        INSERT INTO business_branding (
          business_id,
          logo_data_url,
          primary_colour,
          accent_colour,
          background_colour,
          surface_colour,
          text_colour,
          form_style,
          logo_position,
          show_business_name,
          show_contact_details,
          footer_text,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(business_id)
        DO UPDATE SET
          logo_data_url = excluded.logo_data_url,
          primary_colour = excluded.primary_colour,
          accent_colour = excluded.accent_colour,
          background_colour = excluded.background_colour,
          surface_colour = excluded.surface_colour,
          text_colour = excluded.text_colour,
          form_style = excluded.form_style,
          logo_position = excluded.logo_position,
          show_business_name = excluded.show_business_name,
          show_contact_details = excluded.show_contact_details,
          footer_text = excluded.footer_text,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        user.business_id,
        logoDataUrl,
        body.primary_colour,
        body.accent_colour,
        body.background_colour,
        body.surface_colour,
        body.text_colour,
        formStyle,
        logoPosition,
        body.show_business_name === 0 ? 0 : 1,
        body.show_contact_details === 0 ? 0 : 1,
        String(body.footer_text || "").trim() || null
      )
      .run();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Branding PUT failed:", error);

    return Response.json(
      { ok: false, error: "Unable to save branding." },
      { status: 500 }
    );
  }
}
