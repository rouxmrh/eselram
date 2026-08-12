import {
  decryptIntegrationSecret
} from "./integration-crypto.js";

import {
  issueManageToken
} from "./self-service.js";

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

function formatAppointment(value, timezone, locale = "en-GB") {
  if (!value) return "";

  const local = String(value).replace(" ", "T");

  try {
    const date = new Date(`${local}Z`);

    // Appointments are stored as business-local clock values.
    // Format the components directly so the email mirrors the diary.
    const [datePart, timePart = ""] = local.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    const synthetic = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour || 0,
        minute || 0
      )
    );

    return new Intl.DateTimeFormat(
      locale || "en-GB",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC"
      }
    ).format(synthetic);
  } catch {
    return String(value);
  }
}

function money(minor, currency = "GBP", locale = "en-GB") {
  try {
    return new Intl.NumberFormat(
      locale || "en-GB",
      {
        style: "currency",
        currency:
          String(currency || "GBP")
            .toUpperCase()
      }
    ).format(
      Number(minor || 0) / 100
    );
  } catch {
    return `${currency} ${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getCommunicationSettings(
  env,
  businessId
) {
  const rows =
    await env.DB
      .prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key IN (
            'notifications_booking_confirmation_enabled',
            'notifications_reminder_enabled',
            'notifications_reminder_hours_before',
            'notifications_cancellation_enabled',
            'notifications_reschedule_enabled',
            'notifications_form_reminder_enabled',
            'notifications_form_reminder_hours_after',
            'notifications_payment_receipt_enabled'
          )
      `)
      .bind(businessId)
      .all();

  const map =
    Object.fromEntries(
      (
        rows.results ||
        []
      ).map(
        (row) => [
          row.setting_key,
          row.setting_value
        ]
      )
    );

  const bool = (
    key,
    fallback = true
  ) => {
    const value = map[key];

    if (
      value === undefined ||
      value === null
    ) {
      return fallback;
    }

    return (
      String(value) === "1" ||
      String(value)
        .toLowerCase() ===
        "true"
    );
  };

  return {
    booking_confirmation_enabled:
      bool(
        "notifications_booking_confirmation_enabled",
        true
      ),

    reminder_enabled:
      bool(
        "notifications_reminder_enabled",
        true
      ),

    reminder_hours_before:
      Math.max(
        1,
        Number(
          map.notifications_reminder_hours_before ??
          24
        ) || 24
      ),

    cancellation_enabled:
      bool(
        "notifications_cancellation_enabled",
        true
      ),

    reschedule_enabled:
      bool(
        "notifications_reschedule_enabled",
        true
      ),

    form_reminder_enabled:
      bool(
        "notifications_form_reminder_enabled",
        true
      ),

    form_reminder_hours_after:
      Math.max(
        1,
        Number(
          map.notifications_form_reminder_hours_after ??
          48
        ) || 48
      ),

    payment_receipt_enabled:
      bool(
        "notifications_payment_receipt_enabled",
        true
      )
  };
}

async function getAppointmentContext(
  env,
  businessId,
  appointmentId
) {
  return await env.DB
    .prepare(`
      SELECT
        a.id,
        a.business_id,
        a.customer_id,
        a.status,
        a.start_at,
        a.end_at,
        a.price_minor,
        a.deposit_due_minor,
        a.booking_source,
        a.cancellation_reason,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,

        b.name AS business_name,
        b.email AS business_email,
        b.phone AS business_phone,
        b.website AS business_website,
        b.timezone,
        b.currency,
        b.locale,

        bb.logo_data_url,
        bb.primary_colour,
        bb.background_colour,
        bb.surface_colour,
        bb.text_colour,
        bb.footer_text

      FROM appointments a

      JOIN customers c
        ON c.id = a.customer_id

      JOIN services s
        ON s.id = a.service_id

      JOIN businesses b
        ON b.id = a.business_id

      LEFT JOIN business_branding bb
        ON bb.business_id = a.business_id

      WHERE
        a.id = ?
        AND a.business_id = ?

      LIMIT 1
    `)
    .bind(
      appointmentId,
      businessId
    )
    .first();
}

async function getPaymentSummary(
  env,
  businessId,
  appointmentId
) {
  const row =
    await env.DB
      .prepare(`
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN
                  payment_type = 'refund'
                  AND status = 'paid'
                THEN -ABS(amount_minor)

                WHEN
                  payment_type != 'refund'
                  AND status IN (
                    'paid',
                    'partially_refunded',
                    'refunded'
                  )
                THEN amount_minor

                ELSE 0
              END
            ),
            0
          ) AS net_paid_minor

        FROM payments

        WHERE
          business_id = ?
          AND appointment_id = ?
      `)
      .bind(
        businessId,
        appointmentId
      )
      .first();

  return Math.max(
    0,
    Number(
      row?.net_paid_minor ||
      0
    )
  );
}

async function getEmailIntegration(
  env,
  businessId
) {
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
      .bind(businessId)
      .first();

  if (
    !integration ||
    !integration.encrypted_credentials ||
    ![
      "verified",
      "configured"
    ].includes(
      String(
        integration.status ||
        ""
      )
    )
  ) {
    return {
      error:
        "Email integration is not connected."
    };
  }

  if (
    !String(
      env.ESELRAM_ENCRYPTION_KEY ||
      ""
    ).trim()
  ) {
    return {
      error:
        "ESELRAM_ENCRYPTION_KEY is not configured."
    };
  }

  const credentials =
    parseJson(
      await decryptIntegrationSecret(
        integration.encrypted_credentials,
        env.ESELRAM_ENCRYPTION_KEY
      ),
      {}
    );

  const config =
    parseJson(
      integration.config_json,
      {}
    );

  const apiKey =
    String(
      credentials.api_key ||
      ""
    ).trim();

  const fromName =
    String(
      config.from_name ||
      ""
    ).trim();

  const fromEmail =
    String(
      config.from_email ||
      ""
    ).trim();

  if (
    !apiKey ||
    !fromName ||
    !fromEmail
  ) {
    return {
      error:
        "Email integration is incomplete."
    };
  }

  return {
    apiKey,
    fromName,
    fromEmail
  };
}

function templateFor({
  type,
  appointment,
  paidMinor
}) {
  const businessName =
    appointment.business_name ||
    "Your business";

  const customerName =
    appointment.first_name ||
    "there";

  const appointmentText =
    formatAppointment(
      appointment.start_at,
      appointment.timezone,
      appointment.locale
    );

  const serviceName =
    appointment.service_name ||
    "Appointment";

  const paidText =
    money(
      paidMinor,
      appointment.currency,
      appointment.locale
    );

  const remainingMinor =
    Math.max(
      Number(
        appointment.price_minor ||
        0
      ) -
      paidMinor,
      0
    );

  const remainingText =
    money(
      remainingMinor,
      appointment.currency,
      appointment.locale
    );

  if (
    type ===
    "booking_confirmation"
  ) {
    return {
      subject:
        `Booking confirmed · ${serviceName}`,
      title:
        "Your appointment is confirmed",
      intro:
        `Hi ${customerName}, your booking with ${businessName} is confirmed.`,
      rows: [
        ["Service", serviceName],
        ["Date & time", appointmentText],
        ["Paid", paidText],
        ["Remaining balance", remainingText]
      ],
      closing:
        "We look forward to seeing you."
    };
  }

  if (
    type ===
    "appointment_reminder"
  ) {
    return {
      subject:
        `Appointment reminder · ${serviceName}`,
      title:
        "A reminder about your appointment",
      intro:
        `Hi ${customerName}, this is a reminder about your upcoming appointment with ${businessName}.`,
      rows: [
        ["Service", serviceName],
        ["Date & time", appointmentText]
      ],
      closing:
        "If you need to make a change, please contact the business."
    };
  }

  if (
    type ===
    "cancellation_confirmation"
  ) {
    return {
      subject:
        `Appointment cancelled · ${serviceName}`,
      title:
        "Your appointment has been cancelled",
      intro:
        `Hi ${customerName}, your appointment with ${businessName} has been cancelled.`,
      rows: [
        ["Service", serviceName],
        ["Original date & time", appointmentText],
        [
          "Reason",
          appointment.cancellation_reason ||
          "Not provided"
        ]
      ],
      closing:
        "Any payment or refund is handled separately and remains visible in the business payment record."
    };
  }

  return {
    subject:
      `Appointment updated · ${serviceName}`,
    title:
      "Your appointment has been updated",
    intro:
      `Hi ${customerName}, your appointment with ${businessName} has been updated.`,
    rows: [
      ["Service", serviceName],
      ["New date & time", appointmentText]
    ],
    closing:
      "Please keep this email for your records."
  };
}

function buildHtml({
  appointment,
  template,
  manageUrl = null
}) {
  const primary =
    normaliseHex(
      appointment.primary_colour,
      "#365c50"
    );

  const background =
    normaliseHex(
      appointment.background_colour,
      "#f5f4ef"
    );

  const surface =
    normaliseHex(
      appointment.surface_colour,
      "#ffffff"
    );

  const text =
    normaliseHex(
      appointment.text_colour,
      "#18221f"
    );

  const logo =
    appointment.logo_data_url
      ? `<img src="${escapeHtml(
          appointment.logo_data_url
        )}" alt="${escapeHtml(
          appointment.business_name
        )}" style="max-width:180px;max-height:64px;margin:0 0 20px;">`
      : "";

  const rows =
    template.rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:8px 10px 8px 0;color:#66706b;font-size:13px;vertical-align:top;">
              ${escapeHtml(label)}
            </td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;color:${text};">
              ${escapeHtml(value)}
            </td>
          </tr>
        `
      )
      .join("");

  const footer =
    appointment.footer_text ||
    `Sent by ${appointment.business_name}`;

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${background};font-family:Arial,sans-serif;color:${text};">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
    <div style="background:${surface};border:1px solid rgba(24,34,31,.14);border-radius:18px;padding:30px;">
      ${logo}
      <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${primary};text-transform:uppercase;">
        ${escapeHtml(appointment.business_name)}
      </div>
      <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.15;">
        ${escapeHtml(template.title)}
      </h1>
      <p style="margin:0 0 22px;line-height:1.6;color:#66706b;">
        ${escapeHtml(template.intro)}
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
        ${rows}
      </table>
      <p style="margin:0;line-height:1.6;">
        ${escapeHtml(template.closing)}
      </p>

      ${
        manageUrl
          ? `
            <div style="margin-top:24px;">
              <a
                href="${escapeHtml(manageUrl)}"
                style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
              >
                Manage appointment
              </a>
            </div>
          `
          : ""
      }
    </div>
    <p style="margin:14px 0 0;text-align:center;color:#7b837f;font-size:12px;">
      ${escapeHtml(footer)}
    </p>
  </div>
</body>
</html>`;
}

function buildText({
  appointment,
  template,
  manageUrl = null
}) {
  return [
    template.title,
    "",
    template.intro,
    "",
    ...template.rows.map(
      ([label, value]) =>
        `${label}: ${value}`
    ),
    "",
    template.closing,
    ...(manageUrl
      ? [
          "",
          `Manage appointment: ${manageUrl}`
        ]
      : []),
    "",
    appointment.footer_text ||
      `Sent by ${appointment.business_name}`
  ].join("\n");
}

export async function sendAppointmentCommunication({
  env,
  businessId,
  appointmentId,
  type,
  uniqueKey,
  baseUrl = null
}) {
  const settings =
    await getCommunicationSettings(
      env,
      businessId
    );

  const enabledMap = {
    booking_confirmation:
      settings.booking_confirmation_enabled,
    appointment_reminder:
      settings.reminder_enabled,
    cancellation_confirmation:
      settings.cancellation_enabled,
    reschedule_confirmation:
      settings.reschedule_enabled
  };

  if (
    enabledMap[type] ===
    false
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "disabled"
    };
  }

  const appointment =
    await getAppointmentContext(
      env,
      businessId,
      appointmentId
    );

  if (!appointment) {
    return {
      ok: false,
      skipped: true,
      reason:
        "appointment_not_found"
    };
  }

  const recipient =
    String(
      appointment.email ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!recipient) {
    return {
      ok: true,
      skipped: true,
      reason:
        "no_email"
    };
  }

  let manageUrl = null;

  const resolvedBaseUrl =
    String(
      baseUrl ||
      env.ESELRAM_BASE_URL ||
      ""
    )
      .trim()
      .replace(/\/+$/, "");

  if (
    resolvedBaseUrl &&
    appointment.customer_id
  ) {
    try {
      const manageToken =
        await issueManageToken({
          env,
          businessId,
          appointmentId,
          customerId:
            appointment.customer_id
        });

      manageUrl =
        `${resolvedBaseUrl}/manage-booking/?token=${encodeURIComponent(
          manageToken
        )}`;
    } catch (error) {
      console.error(
        "Unable to create manage-booking link:",
        error
      );
    }
  }


  const paidMinor =
    await getPaymentSummary(
      env,
      businessId,
      appointmentId
    );

  const template =
    templateFor({
      type,
      appointment,
      paidMinor
    });

  const key =
    String(
      uniqueKey ||
      `${type}:${appointmentId}`
    ).slice(0, 500);

  const communicationId =
    `com_${crypto.randomUUID()}`;

  const insert =
    await env.DB
      .prepare(`
        INSERT OR IGNORE INTO customer_communications (
          id,
          business_id,
          appointment_id,
          customer_id,
          communication_type,
          recipient,
          subject,
          status,
          provider,
          unique_key
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          'pending',
          'resend',
          ?
        )
      `)
      .bind(
        communicationId,
        businessId,
        appointmentId,
        appointment.customer_id,
        type,
        recipient,
        template.subject,
        key
      )
      .run();

  if (
    !insert.meta?.changes
  ) {
    return {
      ok: true,
      duplicate: true
    };
  }

  const integration =
    await getEmailIntegration(
      env,
      businessId
    );

  if (integration.error) {
    await env.DB
      .prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        integration.error,
        communicationId
      )
      .run();

    return {
      ok: false,
      error:
        integration.error
    };
  }

  try {
    const response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${integration.apiKey}`,
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              from:
                `${integration.fromName} <${integration.fromEmail}>`,
              to: [
                recipient
              ],
              subject:
                template.subject,
              html:
                buildHtml({
                  appointment,
                  template,
                  manageUrl
                }),
              text:
                buildText({
                  appointment,
                  template,
                  manageUrl
                })
            })
        }
      );

    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        String(
          data?.message ||
          data?.error ||
          "Resend rejected the email."
        )
      );
    }

    await env.DB
      .prepare(`
        UPDATE customer_communications
        SET
          status = 'sent',
          provider_reference = ?,
          sent_at =
            CURRENT_TIMESTAMP,
          error_details = NULL,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        data?.id ||
        null,
        communicationId
      )
      .run();

    return {
      ok: true,
      provider_id:
        data?.id ||
        null
    };
  } catch (error) {
    await env.DB
      .prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        String(
          error?.message ||
          "Unable to send email."
        ).slice(0, 1000),
        communicationId
      )
      .run();

    return {
      ok: false,
      error:
        error?.message ||
        "Unable to send email."
    };
  }
}

export async function sendPaymentReceipt({
  env,
  businessId,
  paymentId
}) {
  const settings =
    await getCommunicationSettings(
      env,
      businessId
    );

  if (
    settings.payment_receipt_enabled ===
      false
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "disabled"
    };
  }

  const row =
    await env.DB
      .prepare(`
        SELECT
          p.id,
          p.appointment_id,
          p.customer_id,
          p.amount_minor,
          p.currency,
          p.payment_type,
          p.payment_method,
          p.status,
          p.paid_at,

          c.first_name,
          c.last_name,
          c.email,

          b.name AS business_name,
          b.email AS business_email,

          a.start_at AS appointment_start_at,
          s.name AS service_name,

          cp.id AS customer_package_id,
          cp.name_snapshot AS package_name,
          cp.price_minor AS package_price_minor,

          (
            SELECT COALESCE(
              SUM(
                CASE
                  WHEN p2.payment_type = 'refund'
                       AND p2.status = 'paid'
                    THEN -ABS(p2.amount_minor)
                  WHEN p2.payment_type != 'refund'
                       AND p2.status IN (
                         'paid',
                         'partially_refunded',
                         'refunded'
                       )
                    THEN ABS(p2.amount_minor)
                  ELSE 0
                END
              ),
              0
            )
            FROM customer_package_payments cpp2
            JOIN payments p2
              ON p2.id = cpp2.payment_id
            WHERE cpp2.customer_package_id = cp.id
          ) AS package_paid_minor

        FROM payments p

        JOIN customers c
          ON c.id = p.customer_id

        JOIN businesses b
          ON b.id = p.business_id

        LEFT JOIN appointments a
          ON a.id = p.appointment_id

        LEFT JOIN services s
          ON s.id = a.service_id

        LEFT JOIN customer_package_payments cpp
          ON cpp.payment_id = p.id

        LEFT JOIN customer_packages cp
          ON cp.id = cpp.customer_package_id

        WHERE
          p.id = ?
          AND p.business_id = ?

        LIMIT 1
      `)
      .bind(
        paymentId,
        businessId
      )
      .first();

  if (
    !row ||
    ![
      "paid",
      "partially_refunded",
      "refunded"
    ].includes(
      String(
        row.status ||
        ""
      )
    ) ||
    row.payment_type ===
      "refund"
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "not_paid"
    };
  }

  const recipient =
    String(
      row.email ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!recipient) {
    return {
      ok: true,
      skipped: true,
      reason: "no_email"
    };
  }

  const isPackage =
    Boolean(
      row.customer_package_id
    );

  const amountText =
    money(
      row.amount_minor,
      row.currency ||
      "GBP"
    );

  const packageOutstanding =
    isPackage
      ? Math.max(
          Number(
            row.package_price_minor ||
            0
          ) -
          Number(
            row.package_paid_minor ||
            0
          ),
          0
        )
      : 0;

  const subject =
    isPackage
      ? `Package payment received · ${
          row.package_name ||
          "Package"
        }`
      : `Payment received · ${
          row.service_name ||
          row.business_name
        }`;

  const title =
    isPackage
      ? "Your package payment is confirmed"
      : "Your payment is confirmed";

  const detailRows =
    isPackage
      ? [
          ["Package", row.package_name || "Package"],
          ["Payment received", amountText],
          [
            "Remaining package balance",
            money(
              packageOutstanding,
              row.currency ||
              "GBP"
            )
          ]
        ]
      : [
          [
            "Service",
            row.service_name ||
            "Payment"
          ],
          ["Payment received", amountText]
        ];

  const communicationType =
    isPackage
      ? "package_payment_confirmation"
      : "payment_receipt";

  const communicationId =
    `com_${crypto.randomUUID()}`;

  const uniqueKey =
    `${communicationType}:${paymentId}`;

  const insert =
    await env.DB
      .prepare(`
        INSERT OR IGNORE INTO customer_communications (
          id,
          business_id,
          appointment_id,
          customer_id,
          payment_id,
          customer_package_id,
          communication_type,
          recipient,
          subject,
          status,
          provider,
          unique_key
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'pending',
          'resend',
          ?
        )
      `)
      .bind(
        communicationId,
        businessId,
        row.appointment_id ||
        null,
        row.customer_id,
        paymentId,
        row.customer_package_id ||
        null,
        communicationType,
        recipient,
        subject,
        uniqueKey
      )
      .run();

  if (!insert.meta?.changes) {
    return {
      ok: true,
      duplicate: true
    };
  }

  const integration =
    await getEmailIntegration(
      env,
      businessId
    );

  if (integration.error) {
    await env.DB
      .prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        integration.error,
        communicationId
      )
      .run();

    return {
      ok: false,
      error: integration.error
    };
  }

  const rowsHtml =
    detailRows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:7px 10px 7px 0;color:#66706b;font-size:13px;">
              ${escapeHtml(label)}
            </td>
            <td style="padding:7px 0;font-size:14px;font-weight:700;">
              ${escapeHtml(value)}
            </td>
          </tr>
        `
      )
      .join("");

  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#f5f4ef;font-family:Arial,sans-serif;color:#18221f;">
      <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
        <div style="background:#fff;border-radius:18px;padding:30px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#365c50;">
            ${escapeHtml(row.business_name)}
          </div>
          <h1 style="margin:10px 0 14px;font-size:27px;">
            ${escapeHtml(title)}
          </h1>
          <p style="line-height:1.6;">
            Hi ${escapeHtml(row.first_name || "there")}, thank you. We have received your payment.
          </p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;">
            ${rowsHtml}
          </table>
          <p style="margin:20px 0 0;line-height:1.6;color:#66706b;">
            Please keep this email for your records.
          </p>
        </div>
      </div>
    </body></html>`;

  const text = [
    title,
    "",
    `Hi ${row.first_name || "there"},`,
    "",
    "Thank you. We have received your payment.",
    "",
    ...detailRows.map(
      ([label, value]) =>
        `${label}: ${value}`
    ),
    "",
    "Please keep this email for your records."
  ].join("\n");

  try {
    const response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${integration.apiKey}`,
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              from:
                `${integration.fromName} <${integration.fromEmail}>`,
              to: [
                recipient
              ],
              subject,
              html,
              text,
              ...(row.business_email
                ? {
                    reply_to:
                      row.business_email
                  }
                : {})
            })
        }
      );

    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        String(
          data?.message ||
          data?.error ||
          "Resend rejected the email."
        )
      );
    }

    await env.DB
      .prepare(`
        UPDATE customer_communications
        SET
          status = 'sent',
          provider_reference = ?,
          sent_at = CURRENT_TIMESTAMP,
          error_details = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        data?.id ||
        null,
        communicationId
      )
      .run();

    return {
      ok: true,
      provider_id:
        data?.id ||
        null
    };
  } catch (error) {
    await env.DB
      .prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        String(
          error?.message ||
          "Unable to send payment receipt."
        ).slice(
          0,
          1000
        ),
        communicationId
      )
      .run();

    return {
      ok: false,
      error:
        error?.message ||
        "Unable to send payment receipt."
    };
  }
}


export function localNowString(timezone) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone ||
          "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }
    );

  const parts =
    Object.fromEntries(
      formatter
        .formatToParts(
          new Date()
        )
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value
          ]
        )
    );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function localIsoToMinuteNumber(value) {
  const match =
    String(value || "")
      .match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
      );

  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute
  ] = match.map(Number);

  return (
    Math.floor(
      Date.UTC(
        year,
        month - 1,
        day
      ) /
      60000
    ) +
    (hour * 60) +
    minute
  );
}

export async function runDueReminders({
  env,
  businessId = null
}) {
  const businesses =
    await env.DB
      .prepare(`
        SELECT
          id,
          timezone

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
          ? [businessId]
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
    const settings =
      await getCommunicationSettings(
        env,
        business.id
      );

    if (
      !settings.reminder_enabled
    ) {
      continue;
    }

    const nowLocal =
      localNowString(
        business.timezone
      );

    const nowMinute =
      localIsoToMinuteNumber(
        nowLocal
      );

    const appointments =
      await env.DB
        .prepare(`
          SELECT id, start_at

          FROM appointments

          WHERE
            business_id = ?
            AND status = 'confirmed'
            AND datetime(start_at) >
                datetime(?)
            AND datetime(start_at) <
                datetime(?, '+4 days')

          ORDER BY
            datetime(start_at) ASC
        `)
        .bind(
          business.id,
          nowLocal,
          nowLocal
        )
        .all();

    for (
      const appointment of
      appointments.results ||
      []
    ) {
      checked += 1;

      const appointmentMinute =
        localIsoToMinuteNumber(
          appointment.start_at
        );

      if (
        appointmentMinute === null ||
        nowMinute === null
      ) {
        continue;
      }

      const minutesUntil =
        appointmentMinute -
        nowMinute;

      const targetMinutes =
        Number(
          settings.reminder_hours_before ||
          24
        ) *
        60;

      // One-hour scheduler window. With an hourly cron this sends once.
      if (
        minutesUntil <=
          targetMinutes ||
        minutesUntil >
          targetMinutes +
          60
      ) {
        continue;
      }

      const result =
        await sendAppointmentCommunication({
          env,
          businessId:
            business.id,
          appointmentId:
            appointment.id,
          type:
            "appointment_reminder",
          uniqueKey:
            `appointment_reminder:${appointment.id}`,
          baseUrl:
            env.ESELRAM_BASE_URL ||
            null
        });

      if (result.ok) {
        if (!result.duplicate) {
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
