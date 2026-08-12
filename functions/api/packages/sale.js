import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../lib/stripe-business.js";

import {
  findAvailableConsultationCredit
} from "../../../lib/consultation-credit.js";


async function getUserContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);

  return await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.business_id,
      b.currency
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN businesses b ON b.id = u.business_id
    WHERE
      s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();
}

function badRequest(message) {
  return Response.json({ ok: false, error: message }, { status: 400 });
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
    const customerId = String(body.customer_id || "").trim();
    const templateId = String(body.package_template_id || "").trim();
    const paymentChoice = String(body.payment_choice || "full").trim();

    if (!customerId || !templateId) {
      return badRequest("Customer and package are required.");
    }

    if (!["deposit", "full"].includes(paymentChoice)) {
      return badRequest("Choose deposit or full payment.");
    }

    const customer = await env.DB.prepare(`
      SELECT id, first_name, last_name, email
      FROM customers
      WHERE id = ? AND business_id = ?
      LIMIT 1
    `).bind(customerId, user.business_id).first();

    if (!customer) return badRequest("Customer not found.");
    if (!customer.email) {
      return badRequest("Add an email address to the customer before taking an online package payment.");
    }

    const template = await env.DB.prepare(`
      SELECT
        id, service_id, name, sessions_total,
        price_minor, deposit_minor, validity_days, is_active
      FROM package_templates
      WHERE id = ? AND business_id = ?
      LIMIT 1
    `).bind(templateId, user.business_id).first();

    if (!template || Number(template.is_active) !== 1) {
      return badRequest("Package is unavailable.");
    }

    const price = Math.max(0, Number(template.price_minor || 0));
    const deposit = Math.max(0, Number(template.deposit_minor || 0));

    const availableCredit =
      await findAvailableConsultationCredit({
        env,
        businessId: user.business_id,
        customerId: customer.id,
        serviceId: template.service_id
      });

    const consultationCreditSourceAppointmentId =
      availableCredit.source_appointment_id;

    const consultationCreditMinor =
      Math.min(
        Number(availableCredit.available_minor || 0),
        price
      );

    const amountBeforeCredit =
      paymentChoice === "deposit"
        ? Math.min(deposit, price)
        : price;

    const amountMinor = Math.max(
      amountBeforeCredit - consultationCreditMinor,
      0
    );

    if (
      amountBeforeCredit <= 0 &&
      consultationCreditMinor <= 0
    ) {
      return badRequest(
        paymentChoice === "deposit"
          ? "This package does not have a deposit configured."
          : "This package does not require an online payment."
      );
    }

    const saleId = `psl_${crypto.randomUUID()}`;
    const currency = String(user.currency || "GBP").toUpperCase();

    if (amountMinor <= 0 && consultationCreditMinor > 0) {
      const customerPackageId = `cpk_${crypto.randomUUID()}`;
      const validityDays = Number(template.validity_days || 0);

      await env.DB.prepare(`
        INSERT INTO customer_packages (
          id, business_id, customer_id, package_template_id, service_id,
          name_snapshot, sessions_total, price_minor, status,
          starts_on, expires_on, notes
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, 'active', date('now'),
          CASE WHEN ? > 0 THEN date('now', '+' || ? || ' days') ELSE NULL END,
          'Created from package sale using consultation credit'
        )
      `).bind(
        customerPackageId,
        user.business_id,
        customer.id,
        template.id,
        template.service_id,
        template.name,
        template.sessions_total,
        price,
        validityDays,
        validityDays
      ).run();

      await env.DB.prepare(`
        INSERT INTO package_sales (
          id, business_id, customer_id, package_template_id,
          source, payment_choice, amount_minor, currency,
          status, payment_id, customer_package_id, created_by_user_id,
          paid_at, consultation_credit_source_appointment_id,
          consultation_credit_minor
        )
        VALUES (
          ?, ?, ?, ?, 'staff', ?, 0, ?, 'paid', NULL, ?, ?,
          CURRENT_TIMESTAMP, ?, ?
        )
      `).bind(
        saleId,
        user.business_id,
        customer.id,
        template.id,
        paymentChoice,
        currency,
        customerPackageId,
        user.user_id,
        consultationCreditSourceAppointmentId,
        consultationCreditMinor
      ).run();

      return Response.json({
        ok: true,
        sale_id: saleId,
        customer_package_id: customerPackageId,
        payment_required: false,
        consultation_credit_minor: consultationCreditMinor,
        currency
      });
    }

    const integration = await getBusinessStripeIntegration(
      env,
      user.business_id
    );

    if (integration.error) {
      return Response.json(
        { ok: false, error: integration.error },
        { status: 503 }
      );
    }

    if (integration.row.status !== "verified") {
      return badRequest(
        "Test the Stripe connection in Settings → Payments before taking package payments."
      );
    }

    const paymentId = `pay_${crypto.randomUUID()}`;
    const stripeCurrency = String(
      integration.config.currency || user.currency || "GBP"
    ).toUpperCase();

    await env.DB.prepare(`
      INSERT INTO payments (
        id, business_id, appointment_id, customer_id,
        provider, payment_type, amount_minor, currency,
        status, payment_method, notes
      )
      VALUES (?, ?, NULL, ?, 'stripe', ?, ?, ?, 'pending', 'card', ?)
    `).bind(
      paymentId,
      user.business_id,
      customer.id,
      paymentChoice === "deposit" ? "deposit" : "full",
      amountMinor,
      stripeCurrency,
      `Package sale: ${template.name} · consultation credit ${consultationCreditMinor}`
    ).run();

    await env.DB.prepare(`
      INSERT INTO package_sales (
        id, business_id, customer_id, package_template_id,
        source, payment_choice, amount_minor, currency,
        status, payment_id, created_by_user_id,
        consultation_credit_source_appointment_id, consultation_credit_minor
      )
      VALUES (?, ?, ?, ?, 'staff', ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(
      saleId,
      user.business_id,
      customer.id,
      template.id,
      paymentChoice,
      amountMinor,
      stripeCurrency,
      paymentId,
      user.user_id,
      consultationCreditSourceAppointmentId,
      consultationCreditMinor
    ).run();

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set(
      "success_url",
      `${origin}/packages/?package_sale=success&sale_id=${encodeURIComponent(saleId)}&session_id={CHECKOUT_SESSION_ID}`
    );
    params.set(
      "cancel_url",
      `${origin}/packages/?package_sale=cancelled&sale_id=${encodeURIComponent(saleId)}`
    );
    params.set("customer_email", customer.email);
    params.set("client_reference_id", saleId);
    params.set("line_items[0][price_data][currency]", stripeCurrency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(amountMinor));
    params.set(
      "line_items[0][price_data][product_data][name]",
      paymentChoice === "deposit"
        ? `${template.name} deposit`
        : template.name
    );
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[payment_id]", paymentId);
    params.set("metadata[business_id]", user.business_id);
    params.set("metadata[package_sale_id]", saleId);
    params.set("metadata[package_template_id]", template.id);
    params.set("metadata[package_sale_source]", "staff");
    params.set("payment_intent_data[metadata][payment_id]", paymentId);
    params.set("payment_intent_data[metadata][business_id]", user.business_id);
    params.set("payment_intent_data[metadata][package_sale_id]", saleId);

    const result = await stripeRequest({
      secretKey: integration.secretKey,
      path: "/v1/checkout/sessions",
      method: "POST",
      body: params
    });

    if (!result.response.ok || !result.data?.id || !result.data?.url) {
      const message = stripeErrorMessage(
        result.data,
        "Unable to create Stripe Checkout."
      );

      await env.DB.prepare(`
        UPDATE package_sales
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind(saleId, user.business_id).run();

      await env.DB.prepare(`
        UPDATE payments
        SET status = 'failed', notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind(message.slice(0, 1000), paymentId, user.business_id).run();

      return Response.json({ ok: false, error: message }, { status: 502 });
    }

    await env.DB.prepare(`
      UPDATE package_sales
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(result.data.id, saleId, user.business_id).run();

    await env.DB.prepare(`
      UPDATE payments
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(result.data.id, paymentId, user.business_id).run();

    return Response.json({
      ok: true,
      sale_id: saleId,
      checkout_url: result.data.url,
      amount_minor: amountMinor,
      currency: stripeCurrency,
      consultation_credit_minor: consultationCreditMinor,
      payment_required: true
    });
  } catch (error) {
    console.error("Package sale failed:", error);
    return Response.json(
      { ok: false, error: "Unable to start package sale." },
      { status: 500 }
    );
  }
}
