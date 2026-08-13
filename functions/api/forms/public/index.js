import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

async function getAuthenticatedUser(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;

  const tokenHash = await hashSessionToken(token);

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
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const mode = String(url.searchParams.get("mode") || "").trim();
    const templateId = String(url.searchParams.get("template_id") || "").trim();
    const token = String(url.searchParams.get("token") || "").trim();
    const requestToken = String(
      url.searchParams.get("request_token") || ""
    ).trim();

    let template = null;
    let businessId = null;
    let formRequest = null;

    if (mode === "preview") {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return Response.json(
          { ok: false, error: "Authentication required." },
          { status: 401 }
        );
      }

      if (!templateId) {
        return Response.json(
          { ok: false, error: "template_id is required." },
          { status: 400 }
        );
      }

      template = await env.DB
        .prepare(`
          SELECT
            id,
            business_id,
            name,
            description,
            template_type,
            is_published,
            public_token
          FROM clinical_templates
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `)
        .bind(templateId, user.business_id)
        .first();

      businessId = user.business_id;
    } else if (requestToken) {
      const internalRequest = requestToken.startsWith("fri_");
      const user = internalRequest
        ? await getAuthenticatedUser(request, env)
        : null;

      if (internalRequest && !user) {
        return Response.json(
          { ok: false, error: "Authentication required." },
          { status: 401 }
        );
      }

      formRequest = await env.DB
        .prepare(
          internalRequest
            ? `
                SELECT
                  r.id, r.business_id, r.template_id, r.customer_id,
                  r.appointment_id, r.status, r.expires_at,
                  t.name, t.description, t.template_type,
                  t.is_published, t.public_token
                FROM clinical_form_requests r
                JOIN clinical_templates t ON t.id = r.template_id
                WHERE
                  r.request_token = ?
                  AND r.business_id = ?
                  AND r.status IN ('created', 'opened')
                  AND datetime(r.expires_at) > datetime('now')
                  AND t.is_active = 1
                LIMIT 1
              `
            : `
                SELECT
                  r.id, r.business_id, r.template_id, r.customer_id,
                  r.appointment_id, r.status, r.expires_at,
                  t.name, t.description, t.template_type,
                  t.is_published, t.public_token
                FROM clinical_form_requests r
                JOIN clinical_templates t ON t.id = r.template_id
                WHERE
                  r.request_token = ?
                  AND r.status IN ('created', 'opened')
                  AND datetime(r.expires_at) > datetime('now')
                  AND t.is_published = 1
                  AND t.is_active = 1
                LIMIT 1
              `
        )
        .bind(
          ...(internalRequest
            ? [requestToken, user.business_id]
            : [requestToken])
        )
        .first();

      if (formRequest) {
        template = {
          id: formRequest.template_id,
          business_id: formRequest.business_id,
          name: formRequest.name,
          description: formRequest.description,
          template_type: formRequest.template_type,
          is_published: formRequest.is_published,
          public_token: formRequest.public_token
        };

        businessId = formRequest.business_id;

        if (formRequest.status === "created") {
          await env.DB
            .prepare(`
              UPDATE clinical_form_requests
              SET
                status = 'opened',
                opened_at = COALESCE(
                  opened_at,
                  CURRENT_TIMESTAMP
                )
              WHERE
                id = ?
                AND status = 'created'
            `)
            .bind(formRequest.id)
            .run();

          formRequest.status = "opened";
        }
      }
    } else {
      if (!token) {
        return Response.json(
          { ok: false, error: "Form token is required." },
          { status: 400 }
        );
      }

      template = await env.DB
        .prepare(`
          SELECT
            id,
            business_id,
            name,
            description,
            template_type,
            is_published,
            public_token
          FROM clinical_templates
          WHERE
            public_token = ?
            AND is_published = 1
            AND is_active = 1
          LIMIT 1
        `)
        .bind(token)
        .first();

      businessId = template?.business_id || null;
    }

    if (!template) {
      return Response.json(
        { ok: false, error: "Form not found or unavailable." },
        { status: 404 }
      );
    }

    const [sectionsResult, fieldsResult, business, branding] = await Promise.all([
      env.DB
        .prepare(`
          SELECT
            id,
            title,
            description,
            sort_order,
            condition_json
          FROM clinical_template_sections
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `)
        .bind(businessId, template.id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            id,
            section_id,
            label,
            field_key,
            field_type,
            help_text,
            placeholder,
            options_json,
            is_required,
            sort_order,
            condition_json
          FROM clinical_template_fields
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `)
        .bind(businessId, template.id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            id,
            name
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `)
        .bind(businessId)
        .first(),

      env.DB
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
        .bind(businessId)
        .first()
    ]);

    const sections = (sectionsResult.results || []).map(section => ({
      ...section,
      condition: parseJson(section.condition_json, null),
      fields: []
    }));

    const sectionMap = new Map(
      sections.map(section => [section.id, section])
    );

    for (const field of fieldsResult.results || []) {
      const section = sectionMap.get(field.section_id);
      if (!section) continue;

      section.fields.push({
        ...field,
        options: parseJson(field.options_json, []),
        condition: parseJson(field.condition_json, null),
        multiple: 0
      });
    }

    return Response.json({
      ok: true,
      preview: mode === "preview",
      request: formRequest
        ? {
            id: formRequest.id,
            customer_id: formRequest.customer_id,
            appointment_id: formRequest.appointment_id,
            status: formRequest.status
          }
        : null,
      business: {
        id: business?.id,
        name: business?.name || "Business",
        contact_line: business?.name || ""
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
      },
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        template_type: template.template_type,
        is_published: template.is_published,
        public_token: template.public_token,
        sections
      }
    });
  } catch (error) {
    console.error("Form renderer lookup failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load form." },
      { status: 500 }
    );
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
