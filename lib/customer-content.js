const EMAIL_SETTING_KEY =
  "communications.email_templates";

const BOOKING_SETTING_KEY =
  "communications.public_booking_copy";


export const EMAIL_TEMPLATE_DEFAULTS = {
  booking_confirmation: {
    label: "Booking confirmed",
    description:
      "Sent when an appointment is confirmed.",
    subject:
      "Booking confirmed · {{service_name}}",
    title:
      "Your appointment is confirmed",
    intro:
      "Hi {{customer_name}}, your booking with {{business_name}} is confirmed.",
    closing:
      "{{default_closing}}"
  },

  appointment_reminder: {
    label: "Appointment reminder",
    description:
      "Sent before an upcoming appointment.",
    subject:
      "Appointment reminder · {{service_name}}",
    title:
      "A reminder about your appointment",
    intro:
      "Hi {{customer_name}}, this is a reminder about your upcoming appointment with {{business_name}}.",
    closing:
      "If you need to make a change, please contact the business."
  },

  cancellation_confirmation: {
    label: "Cancellation confirmation",
    description:
      "Sent when an appointment is cancelled.",
    subject:
      "Appointment cancelled · {{service_name}}",
    title:
      "Your appointment has been cancelled",
    intro:
      "Hi {{customer_name}}, your appointment with {{business_name}} has been cancelled.",
    closing:
      "Any payment or refund is handled separately and remains visible in the business payment record."
  },

  reschedule_confirmation: {
    label: "Appointment updated",
    description:
      "Sent when an appointment is rescheduled or updated.",
    subject:
      "Appointment updated · {{service_name}}",
    title:
      "Your appointment has been updated",
    intro:
      "Hi {{customer_name}}, your appointment with {{business_name}} has been updated.",
    closing:
      "Please keep this email for your records."
  },

  payment_receipt: {
    label: "Payment received",
    description:
      "Sent after a payment for an appointment is recorded.",
    subject:
      "{{default_subject}}",
    title:
      "{{default_title}}",
    intro:
      "Hi {{customer_name}}, thank you. We have received your payment.",
    closing:
      "Please keep this email for your records."
  },

  package_payment_confirmation: {
    label: "Package payment received",
    description:
      "Sent after a package or course payment is recorded.",
    subject:
      "{{default_subject}}",
    title:
      "{{default_title}}",
    intro:
      "Hi {{customer_name}}, thank you. We have received your payment.",
    closing:
      "Please keep this email for your records."
  },

  payment_link: {
    label: "Payment link",
    description:
      "Sent when the business emails a secure Stripe payment link.",
    subject:
      "Payment link · {{service_name}}",
    title:
      "Payment link",
    intro:
      "Hi {{customer_name}}, {{business_name}} has sent you a secure payment link for {{service_name}}.",
    closing:
      "Payment is processed securely by Stripe. If you have already paid, you can ignore this email."
  },

  client_form_request: {
    label: "Client form",
    description:
      "Sent when a customer is asked to complete a form.",
    subject:
      "{{business_name}} — {{form_name}}",
    title:
      "Please complete your form",
    intro:
      "{{business_name}} has sent you a secure {{form_name}} to complete before your appointment.",
    closing:
      "This unique link expires after 30 days and cannot be reused after submission."
  },

  client_form_reminder: {
    label: "Form reminder",
    description:
      "Sent as the automatic or manual reminder for any outstanding client form.",
    subject:
      "Reminder · {{business_name}} — {{form_name}}",
    title:
      "A reminder to complete your form",
    intro:
      "{{business_name}} has sent you a secure {{form_name}} to complete before your appointment.",
    closing:
      "This unique link expires after 30 days and cannot be reused after submission."
  }
};


export const PUBLIC_BOOKING_DEFAULTS = {
  consultation:
    "New clients start with a consultation. The consultation is {{consultation_duration}} minutes and {{consultation_payment}}. {{consultation_credit_sentence}} {{patch_test_sentence}} {{post_consultation_sentence}}",

  standard:
    "Choose the service you would like to book."
};


function parseJson(
  value,
  fallback
) {
  try {
    const parsed =
      JSON.parse(
        String(
          value ||
          ""
        )
      );

    return (
      parsed &&
      typeof parsed ===
        "object"
    )
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
}


function cleanText(
  value,
  maxLength = 3000
) {
  return String(
    value ??
    ""
  )
    .trim()
    .slice(
      0,
      maxLength
    );
}


function mergeEmailTemplate(
  key,
  value
) {
  const fallback =
    EMAIL_TEMPLATE_DEFAULTS[
      key
    ];

  if (!fallback) {
    return null;
  }

  const source =
    value &&
    typeof value ===
      "object"
      ? value
      : {};

  return {
    ...fallback,
    subject:
      cleanText(
        source.subject ??
        fallback.subject,
        240
      ) ||
      fallback.subject,
    title:
      cleanText(
        source.title ??
        fallback.title,
        240
      ) ||
      fallback.title,
    intro:
      cleanText(
        source.intro ??
        fallback.intro,
        3000
      ) ||
      fallback.intro,
    closing:
      cleanText(
        source.closing ??
        fallback.closing,
        3000
      ) ||
      fallback.closing
  };
}


export function cleanEmailTemplate(
  key,
  value
) {
  return mergeEmailTemplate(
    key,
    value
  );
}


async function getSetting(
  env,
  businessId,
  key
) {
  const row =
    await env.DB
      .prepare(`
        SELECT setting_value
        FROM business_settings
        WHERE
          business_id = ?
          AND setting_key = ?
        LIMIT 1
      `)
      .bind(
        businessId,
        key
      )
      .first();

  return row?.setting_value ||
    null;
}


export async function getBusinessEmailTemplates(
  env,
  businessId
) {
  const stored =
    parseJson(
      await getSetting(
        env,
        businessId,
        EMAIL_SETTING_KEY
      ),
      {}
    );

  const result = {};

  for (
    const key of
    Object.keys(
      EMAIL_TEMPLATE_DEFAULTS
    )
  ) {
    result[key] =
      mergeEmailTemplate(
        key,
        stored[key]
      );
  }

  return result;
}


export async function getBusinessEmailOverrides(
  env,
  businessId
) {
  return parseJson(
    await getSetting(
      env,
      businessId,
      EMAIL_SETTING_KEY
    ),
    {}
  );
}


export async function getPublicBookingCopyOverrides(
  env,
  businessId
) {
  const raw =
    parseJson(
      await getSetting(
        env,
        businessId,
        BOOKING_SETTING_KEY
      ),
      {}
    );

  const result = {};

  for (
    const [
      key,
      value
    ] of Object.entries(raw)
  ) {
    const group =
      cleanText(
        key,
        160
      );

    const text =
      cleanText(
        value,
        4000
      );

    if (
      group &&
      text
    ) {
      result[group] =
        text;
    }
  }

  return result;
}


export function interpolateContent(
  value,
  variables = {}
) {
  const source =
    String(
      value ??
      ""
    );

  return source.replace(
    /\{\{\s*([a-z0-9_]+)\s*\}\}/gi,
    (
      match,
      key
    ) => {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            variables,
            key
          )
      ) {
        return String(
          variables[key] ??
          ""
        );
      }

      return match;
    }
  );
}


export async function resolveEmailContent({
  env,
  businessId,
  key,
  fallback,
  variables = {}
}) {
  const overrides =
    await getBusinessEmailOverrides(
      env,
      businessId
    );

  const configured =
    overrides[key];

  if (
    !configured ||
    typeof configured !==
      "object"
  ) {
    return fallback;
  }

  const merged =
    mergeEmailTemplate(
      key,
      configured
    );

  if (!merged) {
    return fallback;
  }

  const vars = {
    ...variables,
    default_subject:
      fallback.subject ||
      "",
    default_title:
      fallback.title ||
      "",
    default_intro:
      fallback.intro ||
      "",
    default_closing:
      fallback.closing ||
      ""
  };

  return {
    ...fallback,
    subject:
      interpolateContent(
        merged.subject,
        vars
      ),
    title:
      interpolateContent(
        merged.title,
        vars
      ),
    intro:
      interpolateContent(
        merged.intro,
        vars
      ),
    closing:
      interpolateContent(
        merged.closing,
        vars
      )
  };
}


export function emailTemplateSettingKey() {
  return EMAIL_SETTING_KEY;
}


export function publicBookingSettingKey() {
  return BOOKING_SETTING_KEY;
}
