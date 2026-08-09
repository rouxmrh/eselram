import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  decryptIntegrationSecret
} from "../../../lib/integration-crypto.js";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseHex(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text)
    ? text
    : fallback;
}

function formatAppointment(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);
  } catch {
    return "";
  }
}

function buildEmailHtml({
  business,
  branding,
  customer,
  appointment,
  formUrl
}) {
  const businessName =
    escapeHtml(business.name || "Your practitioner");

  const firstName =
    escapeHtml(customer.first_name || "there");

  const primary =
    normaliseHex(
      branding?.primary_colour,
      "#365c50"
    );

  const background =
    normaliseHex(
      branding?.background_colour,
      "#f5f4ef"
    );

  const surface =
    normaliseHex(
      branding?.surface_colour,
      "#ffffff"
    );

  const text =
    normaliseHex(
      branding?.text_colour,
      "#18221f"
    );

  const appointmentText =
    appointment
      ? `${escapeHtml(appointment.service_name || "Appointment")} · ${escapeHtml(formatAppointment(appointment.start_at))}`
      : "";

  const footer =
    branding?.footer_text
      ? escapeHtml(branding.footer_text)
      : `Sent securely by ${businessName}`;

  const logo =
    branding?.logo_data_url
      ? `<img src="${escapeHtml(branding.logo_data_url)}" alt="${businessName}" style="max-height:64px;max-width:180px;margin:0 0 20px;">`
      : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${background};font-family:Arial,Helvetica,sans-serif;color:${text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:${surface};border-radius:18px;padding:34px;">
          <tr>
            <td>
              ${logo}
              <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${primary};font-weight:700;margin-bottom:10px;">
                Consultation form
              </div>

              <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:${text};">
                Please complete your consultation form
              </h1>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
                Hi ${firstName},
              </p>

              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                ${businessName} has sent you a secure consultation form to complete before your appointment.
              </p>

              ${
                appointmentText
                  ? `<p style="margin:0 0 22px;padding:14px 16px;background:${background};border-radius:12px;font-size:14px;line-height:1.6;">
                       <strong>${appointmentText}</strong>
                     </p>`
                  : ""
              }

              <p style="margin:26px 0;">
                <a href="${escapeHtml(formUrl)}"
                   style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px;">
                  Complete consultation form
                </a>
              </p>

              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#66706b;">
                This link is unique to you and expires after 30 days. Once submitted, it cannot be used again.
              </p>

              <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#7b847f;">
                ${footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailText({
  business,
  customer,
  appointment,
  formUrl
}) {
  const appointmentText =
    appointment
      ? `\nAppointment: ${appointment.service_name || "Appointment"} · ${formatAppointment(appointment.start_at)}\n`
      : "";

  return [
    `Hi ${customer.first_name || "there"},`,
    "",
    `${business.name || "Your practitioner"} has sent you a secure consultation form to complete before your appointment.`,
    appointmentText,
    `Complete your consultation form: ${formUrl}`,
    "",
    "This unique link expires after 30 days and cannot be reused after submission."
  ].join("\n");
}

export async function onRequestPost({
  request,
  env
}) {
  let formRequestId = "";

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

    formRequestId =
      String(
        body.form_request_id || ""
      ).trim();

    if (!formRequestId) {
      return badRequest(
        "Form request id is required."
      );
    }

    const integration =
      await env.DB
        .prepare(`
          SELECT
            encrypted_credentials,
            config_json,
            status
          FROM business_integrations
          WHERE
            business_id = ?
            AND integration_type = 'email'
            AND provider = 'resend'
          LIMIT 1
        `)
        .bind(
          user.business_id
        )
        .first();

    if (
      !integration ||
      !integration.encrypted_credentials
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email is not configured. Connect the business's own Resend account in Settings → Email."
        },
        {
          status: 503
        }
      );
    }

    if (
      !String(
        env.ESELRAM_ENCRYPTION_KEY || ""
      ).trim()
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This Eselram installation is missing ESELRAM_ENCRYPTION_KEY."
        },
        {
          status: 503
        }
      );
    }

    let integrationConfig = {};
    let integrationCredentials = {};

    try {
      integrationConfig =
        JSON.parse(
          integration.config_json || "{}"
        );

      integrationCredentials =
        JSON.parse(
          await decryptIntegrationSecret(
            integration.encrypted_credentials,
            env.ESELRAM_ENCRYPTION_KEY
          )
        );
    } catch (error) {
      console.error(
        "Unable to read email integration:",
        error
      );

      return Response.json(
        {
          ok: false,
          error:
            "The saved email integration could not be read. Reconnect it in Settings → Email."
        },
        {
          status: 503
        }
      );
    }

    const integrationApiKey =
      String(
        integrationCredentials.api_key || ""
      ).trim();

    const integrationFromName =
      String(
        integrationConfig.from_name || ""
      ).trim();

    const integrationFromEmail =
      String(
        integrationConfig.from_email || ""
      ).trim();

    if (
      !integrationApiKey ||
      !integrationFromName ||
      !integrationFromEmail
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email integration is incomplete. Check Settings → Email."
        },
        {
          status: 503
        }
      );
    }

    const row =
      await env.DB
        .prepare(`
          SELECT
            r.id,
            r.business_id,
            r.customer_id,
            r.appointment_id,
            r.request_token,
            r.status,
            r.expires_at,
            r.email_send_count,

            t.name AS template_name,
            t.is_client_sendable,

            c.first_name,
            c.last_name,
            c.email AS customer_email,

            b.name AS business_name,
            b.email AS business_email,

            a.start_at AS appointment_start_at,
            s.name AS service_name

          FROM clinical_form_requests r

          JOIN clinical_templates t
            ON t.id = r.template_id

          JOIN customers c
            ON c.id = r.customer_id

          JOIN businesses b
            ON b.id = r.business_id

          LEFT JOIN appointments a
            ON a.id = r.appointment_id

          LEFT JOIN services s
            ON s.id = a.service_id

          WHERE
            r.id = ?
            AND r.business_id = ?

          LIMIT 1
        `)
        .bind(
          formRequestId,
          user.business_id
        )
        .first();

    if (!row) {
      return Response.json(
        {
          ok: false,
          error:
            "Consultation form request not found."
        },
        { status: 404 }
      );
    }

    if (
      row.is_client_sendable !== 1 ||
      row.template_name !==
        "General Consultation"
    ) {
      return badRequest(
        "Only General Consultation can be emailed to clients."
      );
    }

    if (
      !["created", "opened"].includes(
        row.status
      )
    ) {
      return badRequest(
        "This consultation form has already been completed or is no longer active."
      );
    }

    if (
      new Date(
        row.expires_at.replace(
          " ",
          "T"
        ) + "Z"
      ).getTime() <= Date.now()
    ) {
      return badRequest(
        "This consultation link has expired."
      );
    }

    const email =
      String(
        row.customer_email || ""
      ).trim();

    if (!email) {
      return badRequest(
        "This customer does not have an email address."
      );
    }

    const branding =
      await env.DB
        .prepare(`
          SELECT
            logo_data_url,
            primary_colour,
            background_colour,
            surface_colour,
            text_colour,
            footer_text
          FROM business_branding
          WHERE business_id = ?
          LIMIT 1
        `)
        .bind(
          user.business_id
        )
        .first();

    const origin =
      new URL(request.url).origin;

    const formUrl =
      `${origin}/forms/view.html?request_token=${encodeURIComponent(row.request_token)}`;

    const business = {
      name:
        row.business_name,
      email:
        row.business_email
    };

    const customer = {
      first_name:
        row.first_name,
      last_name:
        row.last_name
    };

    const appointment =
      row.appointment_id
        ? {
            start_at:
              row.appointment_start_at,
            service_name:
              row.service_name
          }
        : null;

    const subject =
      `${row.business_name} — consultation form`;

    const payload = {
      from:
        `${integrationFromName} <${integrationFromEmail}>`,
      to: [email],
      subject,
      html:
        buildEmailHtml({
          business,
          branding,
          customer,
          appointment,
          formUrl
        }),
      text:
        buildEmailText({
          business,
          customer,
          appointment,
          formUrl
        })
    };

    if (row.business_email) {
      payload.reply_to =
        row.business_email;
    }

    const resendResponse =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${integrationApiKey}`,
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(payload)
        }
      );

    let resendData = {};

    try {
      resendData =
        await resendResponse.json();
    } catch {
      resendData = {};
    }

    if (!resendResponse.ok) {
      const providerError =
        String(
          resendData?.message ||
          resendData?.error ||
          "Email provider rejected the message."
        );

      await env.DB
        .prepare(`
          UPDATE clinical_form_requests
          SET
            email_status = 'failed',
            email_to = ?,
            email_error = ?,
            email_send_count =
              email_send_count + 1
          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          email,
          providerError.slice(0, 1000),
          formRequestId,
          user.business_id
        )
        .run();

      return Response.json(
        {
          ok: false,
          error:
            providerError
        },
        {
          status: 502
        }
      );
    }

    await env.DB
      .prepare(`
        UPDATE clinical_form_requests
        SET
          email_status = 'sent',
          email_to = ?,
          email_sent_at = CURRENT_TIMESTAMP,
          email_provider_id = ?,
          email_error = NULL,
          email_send_count =
            email_send_count + 1
        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        email,
        String(
          resendData?.id || ""
        ) || null,
        formRequestId,
        user.business_id
      )
      .run();

    return Response.json({
      ok: true,
      email: {
        to: email,
        status: "sent",
        provider_id:
          resendData?.id || null,
        send_count:
          Number(
            row.email_send_count || 0
          ) + 1
      }
    });

  } catch (error) {
    console.error(
      "Consultation email send failed:",
      error
    );

    if (formRequestId) {
      try {
        await env.DB
          .prepare(`
            UPDATE clinical_form_requests
            SET
              email_status = 'failed',
              email_error = ?,
              email_send_count =
                email_send_count + 1
            WHERE
              id = ?
          `)
          .bind(
            String(
              error?.message ||
              "Unexpected email error."
            ).slice(0, 1000),
            formRequestId
          )
          .run();
      } catch {
        // Do not mask the original error.
      }
    }

    return Response.json(
      {
        ok: false,
        error:
          "Unable to send consultation email."
      },
      {
        status: 500
      }
    );
  }
}
