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
        a.consultation_credit_minor,
        a.booking_source,
        a.booking_kind,
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


export function aftercareContentFor(serviceName) {
  const value = String(serviceName || "").trim().toLowerCase();

  if (value.includes("tattoo")) {
    return {
      key: "tattoo_removal",
      serviceLabel: "Laser Tattoo Removal",
      sections: [
        ["First 24 Hours", [
          "Keep the treated area clean, cool, and dry.",
          "Use a cold compress if needed to ease heat or swelling.",
          "Avoid touching the area unnecessarily.",
          "Once advised, gently cleanse with a fragrance-free cleanser.",
          "Apply only the recommended healing ointment or a fragrance-free moisturiser.",
          "Do not apply perfumed products, retinoids, acids or other active skincare to the treated area until fully healed."
        ]],
        ["What to Avoid", [
          "Do not pick, scratch, rub, or burst any blistering or scabbing.",
          "Avoid hot baths, saunas, steam rooms, swimming, and intense exercise for 48 hours.",
          "Avoid fake tan, exfoliants, retinoids, or active skincare on the area until healed.",
          "Do not shave over the area if the skin feels sore or irritated."
        ]],
        ["Healing & Skin Protection", [
          "Allow the skin to heal naturally.",
          "Wear loose clothing if the area is irritated.",
          "Keep the treated area out of direct sun exposure.",
          "Once the skin is fully intact, use SPF 50 on exposed areas."
        ]],
        ["Normal Reactions", [
          "Redness and swelling",
          "Frosting immediately after treatment",
          "Tenderness or warmth",
          "Mild blistering or light scabbing",
          "Pinpoint bleeding",
          "Temporary darkening of the tattoo",
          "Itching during healing"
        ]],
        ["When to Contact Your Practitioner", [
          "Excessive swelling or worsening pain",
          "Spreading redness or heat after the initial reaction should be settling",
          "Discharge, unpleasant smell, or signs of infection",
          "Any reaction that feels unusual or causes concern"
        ]]
      ],
      note: "Laser tattoo removal carries risks including blistering, scarring, and pigmentation changes. Healing varies from person to person, and multiple sessions are usually required for best results."
    };
  }

  if (value.includes("carbon") || value.includes("facial")) {
    return {
      key: "carbon_facial",
      serviceLabel: "Carbon Laser Facial",
      sections: [
        ["First 24 Hours", [
          "Keep the skin clean and avoid touching the face unnecessarily.",
          "Cleanse with a gentle, fragrance-free cleanser.",
          "Hydrating products containing hyaluronic acid and a ceramide-rich moisturiser may be used.",
          "Avoid makeup for the rest of the day where possible and drink plenty of water."
        ]],
        ["What to Avoid", [
          "Avoid retinoids, AHAs, BHAs, benzoyl peroxide, exfoliating scrubs and other active skincare for at least 48 hours, or until the skin feels settled.",
          "Avoid fake tan on the face until the skin has fully settled.",
          "Avoid hot baths, saunas, steam rooms, and intense exercise for 24 to 48 hours.",
          "Do not pick, scratch, or aggressively cleanse the skin."
        ]],
        ["Skin Protection", [
          "Use SPF 50 daily after treatment.",
          "Avoid direct sun exposure and sunbeds.",
          "Keep the skin moisturised with a gentle, fragrance-free or ceramide-rich product.",
          "Niacinamide, glycerin, panthenol (Vitamin B5) and squalane are also suitable once the skin feels comfortable."
        ]],
        ["Normal Reactions", [
          "Mild redness",
          "Warmth or tightness",
          "Slight sensitivity",
          "Mild dryness or flaking",
          "Temporary breakouts as the skin clears"
        ]],
        ["When to Contact Your Practitioner", [
          "Redness, heat, or swelling that worsens instead of settling",
          "Blistering, broken skin, or unusual irritation",
          "Any reaction that feels unexpected or causes concern"
        ]]
      ],
      note: "Carbon laser facial treatment can leave the skin temporarily more sensitive. Sun protection and gentle skincare are especially important after treatment."
    };
  }

  if (value.includes("fungal") || value.includes("nail")) {
    return {
      key: "fungal_nail",
      serviceLabel: "Fungal Nail Laser Treatment",
      sections: [
        ["After Treatment", [
          "Keep the feet clean and dry.",
          "Put on clean socks after treatment.",
          "Wear breathable footwear where possible.",
          "Allow nails to grow out naturally over time."
        ]],
        ["Footwear & Hygiene", [
          "Change socks daily and after exercise.",
          "Avoid sharing towels, socks, shoes, or nail tools.",
          "Disinfect or replace old footwear where possible to reduce reinfection risk.",
          "Keep nail clippers and files clean and separate."
        ]],
        ["What to Avoid", [
          "Avoid nail varnish, gel polish, or acrylic overlays unless advised it is suitable.",
          "Avoid tight, sweaty footwear for long periods.",
          "Do not pick or cut the nail too aggressively.",
          "Avoid walking barefoot in communal wet areas."
        ]],
        ["Normal Expectations", [
          "The nail may look unchanged immediately after treatment.",
          "Healthy nail growth can take several months.",
          "Multiple sessions may be recommended.",
          "Good foot hygiene supports the best outcome."
        ]],
        ["When to Contact Your Practitioner", [
          "Pain, swelling, or redness around the nail",
          "Discharge, bleeding, or signs of infection",
          "Any reaction that feels unusual or causes concern"
        ]]
      ],
      note: "Fungal nail laser treatment supports improvement over time, but nail growth is slow. Results vary depending on the nail, the severity of the infection, footwear habits, and ongoing hygiene."
    };
  }

  return null;
}


function aftercareSettingKey(key) {
  return `communications.aftercare.${key}`;
}


function cloneAftercare(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function normaliseAftercareTemplate(
  value,
  fallback
) {
  const source =
    value &&
    typeof value === "object"
      ? value
      : {};

  const sections =
    Array.isArray(source.sections)
      ? source.sections
      : fallback.sections;

  return {
    key: fallback.key,
    serviceLabel:
      String(
        source.serviceLabel ||
        fallback.serviceLabel
      )
        .trim()
        .slice(0, 120) ||
      fallback.serviceLabel,
    sections:
      sections
        .slice(0, 12)
        .map(
          (section, index) => {
            const fallbackSection =
              fallback.sections[index] ||
              ["Section", []];

            const tuple =
              Array.isArray(section)
                ? section
                : [
                    section?.title,
                    section?.items
                  ];

            const title =
              String(
                tuple[0] ||
                fallbackSection[0] ||
                "Section"
              )
                .trim()
                .slice(0, 120);

            const items =
              (
                Array.isArray(tuple[1])
                  ? tuple[1]
                  : []
              )
                .map(
                  item =>
                    String(item || "")
                      .trim()
                      .slice(0, 600)
                )
                .filter(Boolean)
                .slice(0, 30);

            return [
              title || "Section",
              items
            ];
          }
        ),
    note:
      String(
        source.note ??
        fallback.note ??
        ""
      )
        .trim()
        .slice(0, 3000)
  };
}


export function defaultAftercareTemplates() {
  return {
    tattoo_removal:
      cloneAftercare(
        aftercareContentFor(
          "Tattoo Removal"
        )
      ),
    carbon_facial:
      cloneAftercare(
        aftercareContentFor(
          "Carbon Facial"
        )
      ),
    fungal_nail:
      cloneAftercare(
        aftercareContentFor(
          "Fungal Nail Treatment"
        )
      )
  };
}


export async function getBusinessAftercareTemplates(
  env,
  businessId
) {
  const defaults =
    defaultAftercareTemplates();

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
            'communications.aftercare.tattoo_removal',
            'communications.aftercare.carbon_facial',
            'communications.aftercare.fungal_nail'
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
        row => [
          row.setting_key,
          row.setting_value
        ]
      )
    );

  const result = {};

  for (
    const [
      key,
      fallback
    ] of Object.entries(defaults)
  ) {
    let parsed = null;

    try {
      parsed =
        JSON.parse(
          map[
            aftercareSettingKey(key)
          ] ||
          "null"
        );
    } catch {
      parsed = null;
    }

    result[key] =
      normaliseAftercareTemplate(
        parsed,
        fallback
      );
  }

  return result;
}


async function getBusinessAftercareForService(
  env,
  businessId,
  serviceName
) {
  const fallback =
    aftercareContentFor(
      serviceName
    );

  if (!fallback) {
    return null;
  }

  const templates =
    await getBusinessAftercareTemplates(
      env,
      businessId
    );

  return (
    templates[fallback.key] ||
    fallback
  );
}

function aftercareTemplateFor({
  appointment,
  aftercareContent = null
}) {
  const content =
    aftercareContent ||
    aftercareContentFor(
      appointment.service_name
    );

  if (!content) return null;

  const businessName = appointment.business_name || "your practitioner";

  return {
    subject: `Aftercare instructions · ${content.serviceLabel}`,
    title: `${content.serviceLabel} Aftercare`,
    intro: `Hi ${appointment.first_name || "there"}, please follow the aftercare instructions below for the treatment you received from ${businessName}.`,
    rows: [],
    closing: `These instructions are general aftercare guidance. If you feel unwell, experience severe pain, or notice signs of infection, seek appropriate medical advice. If you are unsure whether a reaction is normal, please contact ${businessName}.`,
    aftercare: content
  };
}

function templateFor({
  type,
  appointment,
  paidMinor,
  aftercareContent = null
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
    appointment.booking_kind ===
      "consultation"
      ? `Consultation · ${
          appointment.service_name ||
          "Appointment"
        }`
      : (
          appointment.service_name ||
          "Appointment"
        );

  const paidText =
    money(
      paidMinor,
      appointment.currency,
      appointment.locale
    );

  const consultationCreditMinor =
    Math.max(
      0,
      Number(
        appointment.consultation_credit_minor ||
        0
      )
    );

  const remainingMinor =
    Math.max(
      Number(
        appointment.price_minor ||
        0
      ) -
      paidMinor -
      consultationCreditMinor,
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
    "treatment_aftercare"
  ) {
    return aftercareTemplateFor({
      appointment,
      aftercareContent
    });
  }

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
        ...(consultationCreditMinor > 0
          ? [[
              "Consultation credit",
              money(
                consultationCreditMinor,
                appointment.currency,
                appointment.locale
              )
            ]]
          : []),
        ["Remaining balance", remainingText]
      ],
      closing:
        (
          appointment.booking_kind === "service" &&
          Number(appointment.deposit_due_minor || 0) > 0 &&
          consultationCreditMinor === 0 &&
          paidMinor > 0
        )
          ? "Your booking deposit secures your appointment and is deducted from your treatment total. If you cancel less than 24 hours before your appointment, the deposit is non-refundable. We look forward to seeing you."
          : "We look forward to seeing you."
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


  const aftercareHtml =
    template.aftercare
      ? template.aftercare.sections
          .map(
            ([title, items]) => `
              <div style="margin:0 0 14px;padding:16px;border:1px solid rgba(24,34,31,.12);border-radius:14px;background:${background};">
                <div style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${primary};">
                  ${escapeHtml(title)}
                </div>
                <ul style="margin:0;padding-left:20px;color:${text};">
                  ${items.map(
                    item => `<li style="margin:0 0 7px;line-height:1.5;">${escapeHtml(item)}</li>`
                  ).join("")}
                </ul>
              </div>
            `
          )
          .join("")
      : "";

  const aftercareNote =
    template.aftercare?.note
      ? `
        <div style="margin:18px 0 0;padding:14px 16px;border-left:4px solid ${primary};border-radius:4px 12px 12px 4px;background:${background};line-height:1.55;">
          <strong>Important</strong><br>
          ${escapeHtml(template.aftercare.note)}
        </div>
      `
      : "";

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
      ${aftercareHtml}
      ${aftercareNote}
      ${
        rows
          ? `
            <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
              ${rows}
            </table>
          `
          : ""
      }
      <p style="margin:${template.aftercare ? "18px 0 0" : "0"};line-height:1.6;">
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
    ...(template.aftercare
      ? [
          ...template.aftercare.sections.flatMap(
            ([title, items]) => [
              "",
              title,
              ...items.map(item => `- ${item}`)
            ]
          ),
          "",
          "Important",
          template.aftercare.note
        ]
      : []),
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

  const aftercareContent =
    type === "treatment_aftercare"
      ? await getBusinessAftercareForService(
          env,
          businessId,
          appointment.service_name
        )
      : null;


  const template =
    templateFor({
      type,
      appointment,
      paidMinor,
      aftercareContent
    });

  if (!template) {
    return {
      ok: true,
      skipped: true,
      reason: "unsupported_service"
    };
  }

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
          a.booking_kind AS appointment_booking_kind,
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
          ) AS package_paid_minor,

          (
            SELECT COALESCE(
              SUM(ps.consultation_credit_minor),
              0
            )
            FROM package_sales ps
            WHERE
              ps.business_id = cp.business_id
              AND ps.customer_package_id = cp.id
              AND ps.status = 'paid'
          ) AS package_consultation_credit_minor

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

  const packageConsultationCreditMinor =
    isPackage
      ? Math.max(
          0,
          Number(
            row.package_consultation_credit_minor ||
            0
          )
        )
      : 0;

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
          ) -
          packageConsultationCreditMinor,
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
          row.appointment_booking_kind ===
            "consultation"
            ? `Consultation · ${
                row.service_name ||
                row.business_name
              }`
            : (
                row.service_name ||
                row.business_name
              )
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
          ...(packageConsultationCreditMinor > 0
            ? [[
                "Consultation credit",
                money(
                  packageConsultationCreditMinor,
                  row.currency || "GBP"
                )
              ]]
            : []),
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
            row.appointment_booking_kind ===
              "consultation"
              ? `Consultation · ${
                  row.service_name ||
                  "Payment"
                }`
              : (
                  row.service_name ||
                  "Payment"
                )
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


export async function sendPaymentLinkEmail({
  env,
  businessId,
  appointmentId,
  paymentId,
  checkoutUrl
}) {
  const url =
    String(
      checkoutUrl ||
      ""
    ).trim();

  let parsedUrl;

  try {
    parsedUrl =
      new URL(
        url
      );
  } catch {
    return {
      ok: false,
      error:
        "The Stripe Checkout link is invalid."
    };
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !==
      "checkout.stripe.com"
  ) {
    return {
      ok: false,
      error:
        "Only secure Stripe Checkout links can be emailed."
    };
  }

  const row =
    await env.DB
      .prepare(`
        SELECT
          p.id AS payment_id,
          p.amount_minor,
          p.currency,
          p.status AS payment_status,
          p.provider,

          a.id AS appointment_id,
          a.booking_kind,

          c.id AS customer_id,
          c.first_name,
          c.last_name,
          c.email,

          s.name AS service_name,

          b.id AS business_id,
          b.name AS business_name,

          bb.primary_colour,
          bb.background_colour,
          bb.surface_colour,
          bb.text_colour

        FROM payments p

        JOIN appointments a
          ON a.id =
             p.appointment_id

        JOIN customers c
          ON c.id =
             p.customer_id

        JOIN services s
          ON s.id =
             a.service_id

        JOIN businesses b
          ON b.id =
             p.business_id

        LEFT JOIN business_branding bb
          ON bb.business_id =
             b.id

        WHERE
          p.id = ?
          AND p.appointment_id = ?
          AND p.business_id = ?

        LIMIT 1
      `)
      .bind(
        paymentId,
        appointmentId,
        businessId
      )
      .first();

  if (!row) {
    return {
      ok: false,
      error:
        "The payment link could not be matched to this booking."
    };
  }

  if (
    row.provider !==
      "stripe" ||
    row.payment_status !==
      "pending"
  ) {
    return {
      ok: false,
      error:
        "Only a pending Stripe payment link can be emailed."
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

  if (
    integration.error
  ) {
    return {
      ok: false,
      error:
        integration.error
    };
  }

  const serviceName =
    row.booking_kind ===
      "consultation"
      ? `Consultation · ${
          row.service_name
        }`
      : row.service_name;

  const amountText =
    money(
      row.amount_minor,
      row.currency
    );

  const subject =
    `Payment link · ${
      serviceName
    }`;

  const communicationId =
    `com_${
      crypto.randomUUID()
    }`;

  await env.DB
    .prepare(`
      INSERT INTO customer_communications (
        id,
        business_id,
        appointment_id,
        customer_id,
        payment_id,
        communication_type,
        recipient,
        subject,
        status,
        provider,
        unique_key
      )
      VALUES (
        ?, ?, ?, ?, ?,
        'payment_link',
        ?, ?,
        'pending',
        'resend',
        ?
      )
    `)
    .bind(
      communicationId,
      businessId,
      appointmentId,
      row.customer_id,
      paymentId,
      recipient,
      subject,
      `payment_link:${
        paymentId
      }:${
        crypto.randomUUID()
      }`
    )
    .run();

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

  const textColour =
    normaliseHex(
      row.text_colour,
      "#202a26"
    );

  const customerName =
    row.first_name ||
    "there";

  const html = `
    <div style="margin:0;padding:32px;background:${escapeHtml(
      background
    )};font-family:Arial,sans-serif;color:${escapeHtml(
      textColour
    )}">
      <div style="max-width:560px;margin:0 auto;background:${escapeHtml(
        surface
      )};border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.12em">
          Secure payment
        </p>

        <h1 style="margin:0 0 18px;font-size:26px">
          Payment link
        </h1>

        <p>
          Hi ${escapeHtml(
            customerName
          )},
        </p>

        <p>
          ${escapeHtml(
            row.business_name
          )} has sent you a secure payment link for
          <strong>${escapeHtml(
            serviceName
          )}</strong>.
        </p>

        <p>
          <strong>
            Amount due:
            ${escapeHtml(
              amountText
            )}
          </strong>
        </p>

        <p style="margin:26px 0">
          <a
            href="${escapeHtml(url)}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;background:${escapeHtml(primary)};color:#ffffff !important;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700"
          >
            Pay securely
          </a>
        </p>

        <p style="margin:0 0 18px;font-size:14px;line-height:1.5">
          If the button above does not open, use this secure payment link:
          <br>
          <a
            href="${escapeHtml(url)}"
            target="_blank"
            rel="noopener noreferrer"
            style="color:${escapeHtml(primary)};text-decoration:underline;word-break:break-all"
          >
            Open secure payment page
          </a>
        </p>

        <p style="margin:0 0 18px;font-size:12px;line-height:1.5;word-break:break-all">
          ${escapeHtml(url)}
        </p>

        <p style="margin:0 0 18px;font-size:14px;line-height:1.5">
          If the button above does not open, use this secure payment link:
          <br>
          <a
            href="${escapeHtml(
              url
            )}"
            target="_blank"
            rel="noopener noreferrer"
            style="color:${escapeHtml(
              primary
            )};text-decoration:underline;word-break:break-all"
          >
            Open secure payment page
          </a>
        </p>

        <p style="font-size:13px;opacity:.75">
          Payment is processed securely by Stripe. If you have already paid,
          you can ignore this email.
        </p>
      </div>
    </div>
  `;

  const textBody = [
    `Hi ${
      customerName
    },`,
    "",
    `${row.business_name} has sent you a secure payment link for ${serviceName}.`,
    `Amount due: ${
      amountText
    }`,
    "",
    "Open secure payment page:",
    url,
    "",
    "Payment is processed securely by Stripe."
  ].join("\n");

  try {
    const response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method:
            "POST",
          headers: {
            Authorization:
              `Bearer ${
                integration.apiKey
              }`,
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              from:
                `${
                  integration.fromName
                } <${
                  integration.fromEmail
                }>`,
              to: [
                recipient
              ],
              subject,
              html,
              text:
                textBody
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

    if (
      !response.ok ||
      !data?.id
    ) {
      throw new Error(
        String(
          data?.message ||
          data?.error ||
          "Resend did not accept the payment-link email."
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
        data.id,
        communicationId
      )
      .run();

    return {
      ok: true,
      recipient,
      provider_id:
        data.id
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
          "Unable to send payment link."
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
        "Unable to send payment link."
    };
  }
}
