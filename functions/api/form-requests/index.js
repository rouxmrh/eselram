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

function notFound(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 404 }
  );
}

function requestPath(token) {
  return `/forms/view.html?request_token=${encodeURIComponent(token)}`;
}

async function getCustomer(env, businessId, customerId) {
  if (!customerId) return null;

  return await env.DB
    .prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone
      FROM customers
      WHERE
        id = ?
        AND business_id = ?
      LIMIT 1
    `)
    .bind(customerId, businessId)
    .first();
}

async function getAppointment(env, businessId, appointmentId) {
  if (!appointmentId) return null;

  return await env.DB
    .prepare(`
      SELECT
        a.id,
        a.customer_id,
        a.start_at,
        a.end_at,
        a.status,
        s.name AS service_name
      FROM appointments a
      JOIN services s
        ON s.id = a.service_id
      WHERE
        a.id = ?
        AND a.business_id = ?
      LIMIT 1
    `)
    .bind(appointmentId, businessId)
    .first();
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const url = new URL(request.url);
    const appointmentId = String(
      url.searchParams.get("appointment_id") || ""
    ).trim();
    let customerId = String(
      url.searchParams.get("customer_id") || ""
    ).trim();

    let appointment = null;

    if (appointmentId) {
      appointment = await getAppointment(
        env,
        user.business_id,
        appointmentId
      );

      if (!appointment) {
        return notFound("Appointment not found.");
      }

      customerId = appointment.customer_id;
    }

    const customer = customerId
      ? await getCustomer(env, user.business_id, customerId)
      : null;

    if (customerId && !customer) {
      return notFound("Customer not found.");
    }

    const templates = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          template_type,
          version
        FROM clinical_templates
        WHERE
          business_id = ?
          AND is_active = 1
          AND is_published = 1
          AND is_client_sendable = 1
        ORDER BY
          template_type,
          name COLLATE NOCASE
      `)
      .bind(user.business_id)
      .all();

    let requests = { results: [] };

    if (customerId) {
      requests = await env.DB
        .prepare(`
          SELECT
            r.id,
            r.template_id,
            r.customer_id,
            r.appointment_id,
            r.request_token,
            r.status,
            r.submission_id,
            r.created_at,
            r.opened_at,
            r.submitted_at,
            r.expires_at,

            t.name AS template_name,
            t.template_type,

            a.start_at AS appointment_start_at,
            s.name AS service_name,

            c.first_name,
            c.last_name,

            fs.status AS submission_status

          FROM clinical_form_requests r

          JOIN clinical_templates t
            ON t.id = r.template_id

          JOIN customers c
            ON c.id = r.customer_id

          LEFT JOIN appointments a
            ON a.id = r.appointment_id

          LEFT JOIN services s
            ON s.id = a.service_id

          LEFT JOIN clinical_form_submissions fs
            ON fs.id = r.submission_id

          WHERE
            r.business_id = ?
            AND r.customer_id = ?
            AND (
              ? = ''
              OR r.appointment_id = ?
            )

          ORDER BY
            datetime(r.created_at) DESC

          LIMIT 50
        `)
        .bind(
          user.business_id,
          customerId,
          appointmentId,
          appointmentId
        )
        .all();
    }

    return Response.json({
      ok: true,
      templates: templates.results || [],
      customer,
      appointment,
      requests: (requests.results || []).map(item => ({
        ...item,
        display_status:
          item.submission_status === "reviewed"
            ? "reviewed"
            : item.status,
        url_path: requestPath(item.request_token)
      }))
    });
  } catch (error) {
    console.error("Form requests GET failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load form requests." },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const body = await request.json();

    const templateId = String(body.template_id || "").trim();
    const appointmentId = String(body.appointment_id || "").trim();
    let customerId = String(body.customer_id || "").trim();

    if (!templateId) {
      return badRequest("Choose a form template.");
    }

    const template = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          template_type
        FROM clinical_templates
        WHERE
          id = ?
          AND business_id = ?
          AND is_active = 1
          AND is_published = 1
          AND is_client_sendable = 1
        LIMIT 1
      `)
      .bind(templateId, user.business_id)
      .first();

    if (!template) {
      return badRequest("That clinical form is not available to send to clients.");
    }

    let appointment = null;

    if (appointmentId) {
      appointment = await getAppointment(
        env,
        user.business_id,
        appointmentId
      );

      if (!appointment) {
        return notFound("Appointment not found.");
      }

      if (
        customerId &&
        customerId !== appointment.customer_id
      ) {
        return badRequest(
          "The selected appointment does not belong to this customer."
        );
      }

      customerId = appointment.customer_id;
    }

    if (!customerId) {
      return badRequest("A customer is required.");
    }

    const customer = await getCustomer(
      env,
      user.business_id,
      customerId
    );

    if (!customer) {
      return notFound("Customer not found.");
    }

    const existing = await env.DB
      .prepare(`
        SELECT
          id,
          request_token,
          status,
          expires_at
        FROM clinical_form_requests
        WHERE
          business_id = ?
          AND template_id = ?
          AND customer_id = ?
          AND (
            (? = '' AND appointment_id IS NULL)
            OR appointment_id = ?
          )
          AND status IN ('created', 'opened')
          AND datetime(expires_at) > datetime('now')
        ORDER BY datetime(created_at) DESC
        LIMIT 1
      `)
      .bind(
        user.business_id,
        templateId,
        customerId,
        appointmentId,
        appointmentId
      )
      .first();

    if (existing) {
      return Response.json({
        ok: true,
        reused: true,
        request: {
          ...existing,
          template_id: templateId,
          customer_id: customerId,
          appointment_id: appointmentId || null,
          template_name: template.name,
          url_path: requestPath(existing.request_token)
        }
      });
    }

    const id = `cfr_${crypto.randomUUID()}`;
    const requestToken =
      `frq_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;

    await env.DB
      .prepare(`
        INSERT INTO clinical_form_requests (
          id,
          business_id,
          template_id,
          customer_id,
          appointment_id,
          request_token,
          status,
          created_by_user_id,
          expires_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?,
          'created',
          ?,
          datetime('now', '+30 days')
        )
      `)
      .bind(
        id,
        user.business_id,
        templateId,
        customerId,
        appointmentId || null,
        requestToken,
        user.user_id
      )
      .run();

    return Response.json({
      ok: true,
      reused: false,
      request: {
        id,
        request_token: requestToken,
        template_id: templateId,
        customer_id: customerId,
        appointment_id: appointmentId || null,
        template_name: template.name,
        status: "created",
        url_path: requestPath(requestToken)
      }
    });
  } catch (error) {
    console.error("Form request creation failed:", error);

    return Response.json(
      { ok: false, error: "Unable to create form link." },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const body = await request.json();
    const id = String(body.id || "").trim();
    const action = String(body.action || "").trim();

    if (!id) {
      return badRequest("Form request id is required.");
    }

    if (action !== "revoke") {
      return badRequest("Invalid action.");
    }

    const result = await env.DB
      .prepare(`
        UPDATE clinical_form_requests
        SET
          status = 'revoked',
          revoked_at = CURRENT_TIMESTAMP
        WHERE
          id = ?
          AND business_id = ?
          AND status IN ('created', 'opened')
      `)
      .bind(id, user.business_id)
      .run();

    if (!result.meta?.changes) {
      return badRequest("This form link can no longer be revoked.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Form request update failed:", error);

    return Response.json(
      { ok: false, error: "Unable to update form request." },
      { status: 500 }
    );
  }
}
