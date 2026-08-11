const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashManageToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(String(token || ""))
  );

  return bytesToHex(digest);
}

export async function issueManageToken({
  env,
  businessId,
  appointmentId,
  customerId,
  daysValid = 180
}) {
  const token = randomToken();
  const tokenHash = await hashManageToken(token);
  const safeDays = Math.min(Math.max(Number(daysValid || 180), 7), 365);

  await env.DB
    .prepare(`
      INSERT INTO appointment_manage_tokens (
        id,
        business_id,
        appointment_id,
        customer_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' days'))
    `)
    .bind(
      `amt_${crypto.randomUUID()}`,
      businessId,
      appointmentId,
      customerId,
      tokenHash,
      safeDays
    )
    .run();

  return token;
}

export async function resolveManageToken({
  env,
  token,
  touch = true
}) {
  const value = String(token || "").trim();

  if (!value) {
    return null;
  }

  const tokenHash = await hashManageToken(value);

  const row = await env.DB
    .prepare(`
      SELECT
        mt.id AS token_id,
        mt.business_id,
        mt.appointment_id,
        mt.customer_id,
        mt.expires_at,

        a.service_id,
        a.status,
        a.start_at,
        a.end_at,
        a.price_minor,
        a.deposit_due_minor,
        a.booking_source,
        a.customer_notes,
        a.cancellation_reason,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,
        s.duration_minutes,
        s.requires_consultation,
        s.requires_patch_test,

        b.name AS business_name,
        b.timezone,
        b.currency,
        b.locale,

        bb.logo_data_url,
        bb.primary_colour,
        bb.background_colour,
        bb.surface_colour,
        bb.text_colour

      FROM appointment_manage_tokens mt

      JOIN appointments a
        ON a.id = mt.appointment_id
        AND a.business_id = mt.business_id

      JOIN customers c
        ON c.id = mt.customer_id
        AND c.business_id = mt.business_id

      JOIN services s
        ON s.id = a.service_id
        AND s.business_id = mt.business_id

      JOIN businesses b
        ON b.id = mt.business_id

      LEFT JOIN business_branding bb
        ON bb.business_id = mt.business_id

      WHERE
        mt.token_hash = ?
        AND mt.revoked_at IS NULL
        AND datetime(mt.expires_at) > datetime('now')

      LIMIT 1
    `)
    .bind(tokenHash)
    .first();

  if (row && touch) {
    await env.DB
      .prepare(`
        UPDATE appointment_manage_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(row.token_id)
      .run();
  }

  return row || null;
}

export async function getAppointmentPaymentSummary({
  env,
  businessId,
  appointmentId
}) {
  const rows = await env.DB
    .prepare(`
      SELECT
        payment_type,
        amount_minor,
        currency,
        status
      FROM payments
      WHERE business_id = ?
        AND appointment_id = ?
      ORDER BY datetime(created_at) ASC
    `)
    .bind(businessId, appointmentId)
    .all();

  const payments = rows.results || [];
  let paidMinor = 0;
  let refundedMinor = 0;
  let currency = "GBP";

  payments.forEach(payment => {
    currency = String(payment.currency || currency).toUpperCase();
    const amount = Math.abs(Number(payment.amount_minor || 0));

    if (payment.payment_type === "refund") {
      if (payment.status === "paid") {
        refundedMinor += amount;
      }
      return;
    }

    if (
      ["paid", "partially_refunded", "refunded"].includes(
        String(payment.status || "")
      )
    ) {
      paidMinor += amount;
    }
  });

  return {
    currency,
    paid_minor: paidMinor,
    refunded_minor: refundedMinor,
    net_paid_minor: Math.max(paidMinor - refundedMinor, 0),
    transactions: payments.length
  };
}

export async function getAppointmentForms({
  env,
  businessId,
  appointmentId
}) {
  const rows = await env.DB
    .prepare(`
      SELECT
        r.id,
        r.request_token,
        r.status,
        r.expires_at,
        t.name AS template_name
      FROM clinical_form_requests r
      JOIN clinical_templates t
        ON t.id = r.template_id
      WHERE
        r.business_id = ?
        AND r.appointment_id = ?
        AND r.status IN ('created', 'opened', 'submitted')
      ORDER BY datetime(r.created_at) ASC
    `)
    .bind(businessId, appointmentId)
    .all();

  return (rows.results || []).map(row => ({
    id: row.id,
    name: row.template_name || "Form",
    status: row.status,
    expires_at: row.expires_at,
    url:
      row.status === "submitted"
        ? null
        : `/forms/view.html?request_token=${encodeURIComponent(row.request_token)}`
  }));
}
