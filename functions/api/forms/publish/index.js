import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

async function getUserContext(request, env) {
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

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) {
      return Response.json(
        { ok: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const templateId = String(body.template_id || "").trim();
    const publish = body.publish !== false;

    if (!templateId) {
      return Response.json(
        { ok: false, error: "template_id is required." },
        { status: 400 }
      );
    }

    const template = await env.DB
      .prepare(`
        SELECT
          id,
          public_token
        FROM clinical_templates
        WHERE
          id = ?
          AND business_id = ?
        LIMIT 1
      `)
      .bind(templateId, user.business_id)
      .first();

    if (!template) {
      return Response.json(
        { ok: false, error: "Template not found." },
        { status: 404 }
      );
    }

    let token = template.public_token;

    if (publish && !token) {
      token = crypto.randomUUID().replaceAll("-", "");
    }

    if (publish) {
      await env.DB
        .prepare(`
          UPDATE clinical_templates
          SET
            is_published = 1,
            public_token = ?,
            published_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(token, templateId, user.business_id)
        .run();
    } else {
      await env.DB
        .prepare(`
          UPDATE clinical_templates
          SET
            is_published = 0,
            published_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(templateId, user.business_id)
        .run();
    }

    return Response.json({
      ok: true,
      is_published: publish ? 1 : 0,
      public_token: token,
      public_path: token
        ? `/forms/view.html?token=${encodeURIComponent(token)}`
        : null
    });
  } catch (error) {
    console.error("Form publish failed:", error);

    return Response.json(
      { ok: false, error: "Unable to update form publishing." },
      { status: 500 }
    );
  }
}
