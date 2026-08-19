import {
  resolveEmailContent
} from "./customer-content.js";

import { decryptIntegrationSecret } from "./integration-crypto.js";
import {
  getActiveEmailConnection,
  sendBusinessEmail
} from "./email-delivery.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function normaliseHex(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}
function parseJson(value, fallback = {}) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function formatAppointment(value) {
  if (!value) return "";
  const local = String(value).replace(" ", "T");
  const [datePart,timePart=""] = local.split("T");
  const [year,month,day] = datePart.split("-").map(Number);
  const [hour,minute] = timePart.split(":").map(Number);
  try {
    const synthetic = new Date(Date.UTC(year,month-1,day,hour||0,minute||0));
    return new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).format(synthetic);
  } catch { return String(value); }
}
async function getEmailIntegration(env, businessId) {
  return await getActiveEmailConnection(
    env,
    businessId
  );
}


function emailLogoAttachment(
  dataUrl
) {
  const value =
    String(
      dataUrl ||
      ""
    ).trim();

  const match =
    value.match(
      /^data:image\/(png|jpeg|webp);base64,(.+)$/i
    );

  if (!match) {
    return null;
  }

  const extension =
    match[1]
      .toLowerCase() ===
      "jpeg"
        ? "jpg"
        : match[1]
            .toLowerCase();

  return {
    content:
      match[2],
    filename:
      `logo.${extension}`,
    content_id:
      "eselram-logo"
  };
}


async function getContext(env,businessId,formRequestId) {
  return await env.DB.prepare(`
    SELECT r.id,r.business_id,r.template_id,r.customer_id,r.appointment_id,r.request_token,r.status,r.expires_at,r.email_status,r.email_send_count,
      t.name AS template_name,t.template_type,t.is_client_sendable,
      c.first_name,c.last_name,c.email AS customer_email,
      b.name AS business_name,b.email AS business_email,
      bb.logo_data_url,bb.primary_colour,bb.background_colour,bb.surface_colour,bb.text_colour,bb.footer_text,
      a.start_at AS appointment_start_at,a.booking_kind,s.name AS service_name
    FROM clinical_form_requests r
    JOIN clinical_templates t ON t.id=r.template_id
    JOIN customers c ON c.id=r.customer_id
    JOIN businesses b ON b.id=r.business_id
    LEFT JOIN business_branding bb ON bb.business_id=r.business_id
    LEFT JOIN appointments a ON a.id=r.appointment_id
    LEFT JOIN services s ON s.id=a.service_id
    WHERE r.id=? AND r.business_id=? LIMIT 1`).bind(formRequestId,businessId).first();
}
function buildHtml(row,formUrl,logoUrl=null,content=null) {
  const businessName =
    escapeHtml(
      row.business_name ||
      "Your practitioner"
    );

  const firstName =
    escapeHtml(
      row.first_name ||
      "there"
    );

  const formName =
    escapeHtml(
      row.template_name ||
      "Client form"
    );

  const primary =
    normaliseHex(
      row.primary_colour,
      "#365c50"
    );

  const background =
    normaliseHex(
      row.background_colour,
      "#f5f4ef"
    );

  const surface =
    normaliseHex(
      row.surface_colour,
      "#ffffff"
    );

  const text =
    normaliseHex(
      row.text_colour,
      "#18221f"
    );

  const apptService =
    row.booking_kind ===
      "consultation"
      ? `Consultation · ${
          row.service_name ||
          "Appointment"
        }`
      : (
          row.service_name ||
          "Appointment"
        );

  const appt =
    row.appointment_id
      ? `${escapeHtml(apptService)} · ${escapeHtml(
          formatAppointment(
            row.appointment_start_at
          )
        )}`
      : "";

  const footer =
    row.footer_text
      ? escapeHtml(
          row.footer_text
        )
      : `Sent by ${businessName}`;

  const logo =
    logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${businessName}" style="display:block;max-width:180px;max-height:64px;width:auto;height:auto;margin:0 0 20px;">`
      : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${background};font-family:Arial,sans-serif;color:${text};">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
    <div style="background:${surface};border:1px solid rgba(24,34,31,.14);border-radius:18px;padding:30px;">
      ${logo}

      <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${primary};text-transform:uppercase;">
        ${formName}
      </div>

      <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.15;">
        ${escapeHtml(
          content?.title ||
          "Please complete your form"
        )}
      </h1>

      <p style="margin:0 0 18px;line-height:1.6;">
        Hi ${firstName},
      </p>

      <p style="margin:0 0 20px;line-height:1.6;color:#66706b;">
        ${escapeHtml(
          content?.intro ||
          `${
            row.business_name ||
            "Your practitioner"
          } has sent you a secure ${
            row.template_name ||
            "client form"
          } to complete before your appointment.`
        )}
      </p>

      ${
        appt
          ? `
            <div style="margin:0 0 22px;padding:14px 16px;background:${background};border-radius:12px;font-size:14px;line-height:1.6;">
              <strong>${appt}</strong>
            </div>
          `
          : ""
      }

      <div style="margin-top:24px;">
        <a
          href="${escapeHtml(formUrl)}"
          style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
        >
          Complete ${formName}
        </a>

        <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#66706b;">
          If the button above does not work,
          <a
            href="${escapeHtml(formUrl)}"
            style="color:${primary};text-decoration:underline;font-weight:600;"
          >
            click here to complete your form
          </a>.
        </p>
      </div>

      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#66706b;">
        ${escapeHtml(
          content?.closing ||
          "This unique link expires after 30 days and cannot be reused after submission."
        )}
      </p>
    </div>

    <p style="margin:14px 0 0;text-align:center;color:#7b837f;font-size:12px;">
      ${footer}
    </p>
  </div>
</body>
</html>`;
}

function buildText(row,formUrl,content=null) {
  const apptService =
    row.booking_kind ===
      "consultation"
      ? `Consultation · ${row.service_name || "Appointment"}`
      : (row.service_name || "Appointment");

  const appt =
    row.appointment_id
      ? `\nAppointment: ${apptService} · ${formatAppointment(row.appointment_start_at)}\n`
      : "";

  return [
    content?.title ||
      "Please complete your form",
    "",
    `Hi ${row.first_name || "there"},`,
    "",
    content?.intro ||
      `${row.business_name || "Your practitioner"} has sent you a secure ${row.template_name || "client form"} to complete before your appointment.`,
    appt,
    `Complete your form: ${formUrl}`,
    "",
    content?.closing ||
      "This unique link expires after 30 days and cannot be reused after submission."
  ].join("\n");
}
export async function ensureClientFormRequest({env,businessId,templateId,customerId,appointmentId,createdByUserId=null}) {
  const template=await env.DB.prepare(`SELECT id,name,template_type,is_client_sendable FROM clinical_templates WHERE id=? AND business_id=? AND is_active=1 AND is_published=1 AND is_client_sendable=1 LIMIT 1`).bind(templateId,businessId).first();
  if (!template) return {ok:false,error:"The assigned client form template is unavailable."};
  const existing=await env.DB.prepare(`SELECT id,request_token,status,expires_at,email_status FROM clinical_form_requests WHERE business_id=? AND template_id=? AND customer_id=? AND appointment_id=? AND status IN ('created','opened','submitted') ORDER BY datetime(created_at) DESC LIMIT 1`).bind(businessId,templateId,customerId,appointmentId).first();
  if (existing) {
    if (existing.status==='submitted') return {ok:true,reused:true,completed:true,request:existing};
    const expiry=new Date(String(existing.expires_at||"").replace(" ","T")+"Z").getTime();
    if (expiry>Date.now()) return {ok:true,reused:true,completed:false,request:existing};
  }
  const id=`cfr_${crypto.randomUUID()}`;
  const requestToken=`frq_${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;
  await env.DB.prepare(`INSERT INTO clinical_form_requests (id,business_id,template_id,customer_id,appointment_id,request_token,status,created_by_user_id,expires_at) VALUES (?,?,?,?,?,?,'created',?,datetime('now','+30 days'))`).bind(id,businessId,templateId,customerId,appointmentId,requestToken,createdByUserId).run();
  return {ok:true,reused:false,completed:false,request:{id,request_token:requestToken,status:'created',email_status:'not_sent'}};
}
async function logFormCommunication({
  env,
  row,
  type,
  subject,
  status,
  providerReference = null,
  errorDetails = null,
  forceUnique = false
}) {
  const baseUniqueKey =
    type ===
      "client_form_reminder"
      ? `client_form_reminder:${row.id}`
      : `client_form_request:${row.id}`;

  const uniqueKey = forceUnique
    ? `${baseUniqueKey}:${crypto.randomUUID()}`
    : baseUniqueKey;

  const id =
    `com_${crypto.randomUUID()}`;

  await env.DB
    .prepare(`
      INSERT INTO customer_communications (
        id,
        business_id,
        appointment_id,
        customer_id,
        form_request_id,
        communication_type,
        recipient,
        subject,
        status,
        provider,
        provider_reference,
        unique_key,
        sent_at,
        error_details
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'resend',
        ?,
        ?,
        CASE
          WHEN ? = 'sent'
            THEN CURRENT_TIMESTAMP
          ELSE NULL
        END,
        ?
      )
      ON CONFLICT(unique_key)
      DO UPDATE SET
        status =
          excluded.status,
        provider_reference =
          excluded.provider_reference,
        sent_at =
          CASE
            WHEN excluded.status = 'sent'
              THEN CURRENT_TIMESTAMP
            ELSE customer_communications.sent_at
          END,
        error_details =
          excluded.error_details,
        updated_at =
          CURRENT_TIMESTAMP
    `)
    .bind(
      id,
      row.business_id,
      row.appointment_id ||
      null,
      row.customer_id,
      row.id,
      type,
      String(
        row.customer_email ||
        ""
      )
        .trim()
        .toLowerCase(),
      subject,
      status,
      providerReference ||
      null,
      uniqueKey,
      status,
      errorDetails ||
      null
    )
    .run();
}


export async function sendClientFormRequestEmail({
  env,
  businessId,
  formRequestId,
  baseUrl,
  reminder = false,
  force = false
}) {
  const row =
    await getContext(
      env,
      businessId,
      formRequestId
    );

  if (!row) {
    return {
      ok: false,
      error:
        "Form request not found."
    };
  }

  if (
    Number(
      row.is_client_sendable ||
      0
    ) !== 1
  ) {
    return {
      ok: false,
      error:
        "This form is not available for clients."
    };
  }

  if (
    ![
      "created",
      "opened"
    ].includes(
      String(
        row.status ||
        ""
      )
    )
  ) {
    return {
      ok: true,
      skipped: true,
      reason:
        "inactive"
    };
  }

  if (
    !force &&
    !reminder &&
    row.email_status ===
      "sent"
  ) {
    return {
      ok: true,
      duplicate: true
    };
  }

  if (reminder && !force) {
    const existingReminder =
      await env.DB
        .prepare(`
          SELECT id, status
          FROM customer_communications
          WHERE
            business_id = ?
            AND form_request_id = ?
            AND communication_type =
                'client_form_reminder'
          LIMIT 1
        `)
        .bind(
          businessId,
          formRequestId
        )
        .first();

    if (
      existingReminder &&
      existingReminder.status ===
        "sent"
    ) {
      return {
        ok: true,
        duplicate: true
      };
    }
  }

  const email =
    String(
      row.customer_email ||
      ""
    ).trim();

  if (!email) {
    return {
      ok: false,
      error:
        "This customer does not have an email address."
    };
  }

  const integration =
    await getEmailIntegration(
      env,
      businessId
    );

  if (integration.error) {
    return {
      ok: false,
      error:
        integration.error
    };
  }

  const origin =
    String(
      baseUrl ||
      env.ESELRAM_BASE_URL ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  if (!origin) {
    return {
      ok: false,
      error:
        "Unable to build the secure client form URL."
    };
  }

  const formUrl =
    `${origin}/forms/view.html#request_token=${encodeURIComponent(
      row.request_token
    )}`;

  const communicationType =
    reminder
      ? "client_form_reminder"
      : "client_form_request";

  const defaultContent =
    reminder
      ? {
          subject:
            `Reminder · ${row.business_name} — ${row.template_name}`,
          title:
            "A reminder to complete your form",
          intro:
            `${row.business_name || "Your practitioner"} has sent you a secure ${row.template_name || "client form"} to complete before your appointment.`,
          closing:
            "This unique link expires after 30 days and cannot be reused after submission."
        }
      : {
          subject:
            `${row.business_name} — ${row.template_name}`,
          title:
            "Please complete your form",
          intro:
            `${row.business_name || "Your practitioner"} has sent you a secure ${row.template_name || "client form"} to complete before your appointment.`,
          closing:
            "This unique link expires after 30 days and cannot be reused after submission."
        };

  const emailContent =
    await resolveEmailContent({
      env,
      businessId,
      key:
        communicationType,
      fallback:
        defaultContent,
      variables: {
        customer_name:
          row.first_name ||
          "there",
        business_name:
          row.business_name ||
          "Your practitioner",
        form_name:
          row.template_name ||
          "Client form",
        service_name:
          row.booking_kind ===
            "consultation"
            ? `Consultation · ${
                row.service_name ||
                "Appointment"
              }`
            : (
                row.service_name ||
                "Appointment"
              )
      }
    });

  const subject =
    emailContent.subject;

  const logoUrl =
    row.logo_data_url
      ? `${origin}/api/public-branding/logo`
      : null;

  const html =
    buildHtml(
      row,
      formUrl,
      logoUrl,
      emailContent
    );

  const text =
    buildText(
      row,
      formUrl,
      emailContent
    );

  const payload = {
    from:
      `${integration.fromName} <${integration.fromEmail}>`,
    to: [
      email
    ],
    subject,
    html,
    text
  };

  if (row.business_email) {
    payload.reply_to =
      row.business_email;
  }

  try {
    const delivery =
      await sendBusinessEmail(
        env,
        businessId,
        {
          to: email,
          subject,
          html,
          text,
          replyTo:
            row.business_email || ""
        }
      );

    await env.DB
      .prepare(`
        UPDATE clinical_form_requests

        SET
          email_status = 'sent',
          email_to = ?,
          email_sent_at =
            CASE
              WHEN ? = 0
                THEN CURRENT_TIMESTAMP
              ELSE email_sent_at
            END,
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
        reminder
          ? 1
          : 0,
        String(
          data?.id ||
          ""
        ) ||
        null,
        formRequestId,
        businessId
      )
      .run();

    await logFormCommunication({
      env,
      row,
      type:
        communicationType,
      subject,
      status:
        "sent",
      providerReference:
        delivery?.id ||
        null,
      forceUnique: force
    });

    return {
      ok: true,
      provider_id:
        data?.id ||
        null
    };
  } catch (error) {
    const msg =
      String(
        error?.message ||
        "Unable to send client form email."
      ).slice(
        0,
        1000
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
        msg,
        formRequestId,
        businessId
      )
      .run();

    await logFormCommunication({
      env,
      row,
      type:
        communicationType,
      subject,
      status:
        "failed",
      errorDetails:
        msg,
      forceUnique: force
    });

    return {
      ok: false,
      error:
        msg
    };
  }
}


export async function runDueFormReminders({
  env,
  businessId = null,
  baseUrl = null
}) {
  const businesses =
    await env.DB
      .prepare(`
        SELECT id
        FROM businesses
        WHERE
          status = 'active'
          ${
            businessId
              ? "AND id = ?"
              : ""
          }
      `)
      .bind(
        ...(businessId
          ? [
              businessId
            ]
          : [])
      )
      .all();

  let checked = 0;
  let sent = 0;
  let failed = 0;

  for (
    const business of
    businesses.results ||
    []
  ) {
    const settingsRows =
      await env.DB
        .prepare(`
          SELECT
            setting_key,
            setting_value
          FROM business_settings
          WHERE
            business_id = ?
            AND setting_key IN (
              'notifications_form_reminder_enabled',
              'notifications_form_reminder_hours_after'
            )
        `)
        .bind(
          business.id
        )
        .all();

    const settings =
      Object.fromEntries(
        (
          settingsRows.results ||
          []
        ).map(
          (item) => [
            item.setting_key,
            item.setting_value
          ]
        )
      );

    const enabledValue =
      settings
        .notifications_form_reminder_enabled;

    const enabled =
      enabledValue ===
        undefined ||
      enabledValue ===
        null ||
      String(
        enabledValue
      ) ===
        "1" ||
      String(
        enabledValue
      )
        .toLowerCase() ===
        "true";

    if (!enabled) {
      continue;
    }

    const hours =
      Math.max(
        1,
        Number(
          settings
            .notifications_form_reminder_hours_after ??
          48
        ) ||
        48
      );

    const requests =
      await env.DB
        .prepare(`
          SELECT
            r.id

          FROM clinical_form_requests r

          WHERE
            r.business_id = ?
            AND r.status IN (
              'created',
              'opened'
            )
            AND r.email_status = 'sent'
            AND r.email_sent_at IS NOT NULL
            AND datetime(
              r.email_sent_at
            ) <= datetime(
              'now',
              '-' || ? || ' hours'
            )
            AND datetime(
              r.expires_at
            ) > datetime('now')
            AND NOT EXISTS (
              SELECT 1
              FROM customer_communications cc
              WHERE
                cc.business_id =
                  r.business_id
                AND cc.form_request_id =
                  r.id
                AND cc.communication_type =
                  'client_form_reminder'
                AND cc.status = 'sent'
            )

          ORDER BY
            datetime(
              r.email_sent_at
            ) ASC

          LIMIT 100
        `)
        .bind(
          business.id,
          hours
        )
        .all();

    for (
      const request of
      requests.results ||
      []
    ) {
      checked += 1;

      const result =
        await sendClientFormRequestEmail({
          env,
          businessId:
            business.id,
          formRequestId:
            request.id,
          baseUrl:
            baseUrl ||
            env.ESELRAM_BASE_URL ||
            null,
          reminder:
            true
        });

      if (result.ok) {
        if (
          !result.duplicate &&
          !result.skipped
        ) {
          sent += 1;
        }
      } else {
        failed += 1;
      }
    }
  }

  return {
    checked,
    sent,
    failed
  };
}


export async function runServiceFormAutomation({env,businessId,appointmentId,triggerEvent,baseUrl,createdByUserId=null}) {
  const trigger=String(triggerEvent||"").trim();
  if (!['payment_received','booking_confirmed'].includes(trigger)) return {ok:true,created:0,sent:0,skipped:0,failed:0};
  const appointment=await env.DB.prepare(`
    SELECT
      a.id,
      a.customer_id,
      a.service_id,
      a.status,
      a.booking_kind,
      s.service_type
    FROM appointments a
    JOIN services s
      ON s.id=a.service_id
     AND s.business_id=a.business_id
    WHERE
      a.id=?
      AND a.business_id=?
    LIMIT 1
  `).bind(appointmentId,businessId).first();
  if (!appointment) return {ok:false,error:'Appointment not found.'};
  const rules=await env.DB.prepare(`SELECT r.template_id,t.name AS template_name,t.template_type FROM service_form_rules r JOIN clinical_templates t ON t.id=r.template_id AND t.business_id=r.business_id WHERE r.business_id=? AND r.service_id=? AND r.trigger_event=? AND r.is_active=1 AND t.is_active=1 AND t.is_published=1 AND t.is_client_sendable=1 ORDER BY t.name COLLATE NOCASE ASC`).bind(businessId,appointment.service_id,trigger).all();

  const selectedRules=[...(rules.results||[])];

  // Consultation bookings must always send a consultation form when the
  // appointment is confirmed. Explicit service rules remain authoritative;
  // this fallback restores the original consultation workflow for services
  // that require a consultation but do not have an automatic form rule set.
  const isConsultation =
    appointment.booking_kind==='consultation' ||
    appointment.service_type==='consultation';

  if (isConsultation && trigger==='booking_confirmed') {
    const automaticConsultationRule=await env.DB.prepare(`SELECT 1 AS found FROM service_form_rules r JOIN clinical_templates t ON t.id=r.template_id AND t.business_id=r.business_id WHERE r.business_id=? AND r.service_id=? AND r.trigger_event IN ('booking_confirmed','payment_received') AND r.is_active=1 AND t.template_type='consultation' AND t.is_active=1 AND t.is_published=1 AND t.is_client_sendable=1 LIMIT 1`).bind(businessId,appointment.service_id).first();

    if (!automaticConsultationRule) {
      const fallbackConsultation=await env.DB.prepare(`SELECT id AS template_id,name AS template_name,template_type FROM clinical_templates WHERE business_id=? AND template_type='consultation' AND is_active=1 AND is_published=1 AND is_client_sendable=1 ORDER BY is_default DESC, name COLLATE NOCASE ASC LIMIT 1`).bind(businessId).first();

      if (fallbackConsultation && !selectedRules.some((rule)=>rule.template_id===fallbackConsultation.template_id)) {
        selectedRules.push(fallbackConsultation);
      }
    }
  }

  let created=0,sent=0,skipped=0,failed=0;
  for (const rule of selectedRules) {
    // A submitted consultation is valid for the customer + service, not just
    // for the appointment it was originally requested against. Automatic
    // workflows must therefore not create another consultation form for a
    // later appointment of the same service. Manual form creation remains
    // available from the customer profile when a fresh consultation is
    // intentionally required.
    if (
      String(
        rule.template_type ||
        ""
      ).toLowerCase() ===
        "consultation" &&
      !isConsultation
    ) {
      const completedConsultation =
        await env.DB.prepare(`
          SELECT
            r.id,
            r.submission_id,
            r.submitted_at
          FROM clinical_form_requests r
          JOIN clinical_templates t
            ON t.id = r.template_id
           AND t.business_id = r.business_id
          JOIN appointments prior_appointment
            ON prior_appointment.id = r.appointment_id
           AND prior_appointment.business_id = r.business_id
          WHERE
            r.business_id = ?
            AND r.customer_id = ?
            AND prior_appointment.service_id = ?
            AND t.template_type = 'consultation'
            AND r.status = 'submitted'
          ORDER BY
            datetime(
              COALESCE(
                r.submitted_at,
                r.created_at
              )
            ) DESC
          LIMIT 1
        `).bind(
          businessId,
          appointment.customer_id,
          appointment.service_id
        ).first();

      if (completedConsultation) {
        skipped++;
        continue;
      }
    }

    const req=await ensureClientFormRequest({env,businessId,templateId:rule.template_id,customerId:appointment.customer_id,appointmentId,createdByUserId});
    if (!req.ok) { failed++; console.error('Automatic client form request failed:',appointmentId,rule.template_id,req.error); continue; }
    if (req.completed) { skipped++; continue; }
    if (!req.reused) created++;
    const mail=await sendClientFormRequestEmail({env,businessId,formRequestId:req.request.id,baseUrl});
    if (mail.ok) { if (mail.duplicate||mail.skipped) skipped++; else sent++; }
    else { failed++; console.error('Automatic client form email failed:',appointmentId,rule.template_id,mail.error); }
  }
  return {ok:failed===0,created,sent,skipped,failed};
}
