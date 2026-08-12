import {
  getPublicBusiness,
  findOrCreatePublicCustomer,
  deleteUnusedCustomer,
  validEmail
} from "../../../lib/public-booking.js";

import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../lib/stripe-business.js";


function badRequest(message) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

export async function onRequestPost({ request, env }) {
  let saleId = null;
  let paymentId = null;

  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json(
        { ok: false, error: "Business is unavailable." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const templateId = String(body.package_template_id || "").trim();
    const firstName = String(body.first_name || "").trim().slice(0, 100);
    const lastName = String(body.last_name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const phone = String(body.phone || "").trim().slice(0, 50);
    const paymentChoice = String(body.payment_choice || "full").trim();

    if (!templateId || !firstName || !lastName || !validEmail(email)) {
      return badRequest("Package, name and a valid email address are required.");
    }

    if (!["deposit", "full"].includes(paymentChoice)) {
      return badRequest("Choose deposit or full payment.");
    }

    const template = await env.DB.prepare(`
      SELECT
        pt.id,
        pt.service_id,
        pt.name,
        pt.sessions_total,
        pt.price_minor,
        pt.deposit_minor,
        pt.validity_days,
        s.requires_consultation
      FROM package_templates pt
      JOIN services s
        ON s.id = pt.service_id
       AND s.business_id = pt.business_id
      WHERE
        pt.id = ?
        AND pt.business_id = ?
        AND pt.is_active = 1
        AND pt.is_public = 1
        AND s.is_active = 1
      LIMIT 1
    `).bind(templateId, business.id).first();

    if (!template) return badRequest("That package is no longer available.");

    const customer = await findOrCreatePublicCustomer({
      env,
      businessId: business.id,
      firstName,
      lastName,
      email,
      phone,
      marketingConsent: false
    });

    if (
      Number(
        template.requires_consultation ||
        0
      ) === 1
    ) {
      const completedConsultation =
        await env.DB
          .prepare(`
            SELECT id
            FROM appointments
            WHERE
              business_id = ?
              AND customer_id = ?
              AND service_id = ?
              AND booking_kind =
                  'consultation'
              AND status =
                  'completed'
            ORDER BY
              datetime(start_at) DESC
            LIMIT 1
          `)
          .bind(
            business.id,
            customer.id,
            template.service_id
          )
          .first();

      if (!completedConsultation) {
        if (customer.created) {
          await deleteUnusedCustomer(
            env,
            business.id,
            customer.id
          );
        }

        return Response.json(
          {
            ok: false,
            error:
              "A consultation must be completed before this package can be purchased.",
            consultation_required:
              true,
            service_id:
              template.service_id
          },
          {
            status: 409
          }
        );
      }
    }


    const price = Math.max(0, Number(template.price_minor || 0));
    const deposit = Math.max(0, Number(template.deposit_minor || 0));
    const amountMinor =
      paymentChoice === "deposit"
        ? Math.min(deposit, price)
        : price;

    if (amountMinor <= 0) {
      return badRequest(
        paymentChoice === "deposit"
          ? "This package does not offer a deposit option."
          : "This package cannot be purchased online."
      );
    }

    const integration = await getBusinessStripeIntegration(env, business.id);

    if (integration.error || integration.row.status !== "verified") {
      return Response.json(
        {
          ok: false,
          error: "Online package payment is temporarily unavailable. Please contact the business."
        },
        { status: 503 }
      );
    }

    saleId = `psl_${crypto.randomUUID()}`;
    paymentId = `pay_${crypto.randomUUID()}`;
    const currency = String(
      integration.config.currency || business.currency || "GBP"
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
      business.id,
      customer.id,
      paymentChoice === "deposit" ? "deposit" : "full",
      amountMinor,
      currency,
      `Public package purchase: ${template.name}`
    ).run();

    await env.DB.prepare(`
      INSERT INTO package_sales (
        id, business_id, customer_id, package_template_id,
        source, payment_choice, amount_minor, currency,
        status, payment_id
      )
      VALUES (?, ?, ?, ?, 'public', ?, ?, ?, 'pending', ?)
    `).bind(
      saleId,
      business.id,
      customer.id,
      template.id,
      paymentChoice,
      amountMinor,
      currency,
      paymentId
    ).run();

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set(
      "success_url",
      `${origin}/buy-package/success/?sale_id=${encodeURIComponent(saleId)}&session_id={CHECKOUT_SESSION_ID}`
    );
    params.set(
      "cancel_url",
      `${origin}/buy-package/?cancelled=1&sale_id=${encodeURIComponent(saleId)}`
    );
    params.set("customer_email", email);
    params.set("client_reference_id", saleId);
    params.set("expires_at", String(Math.floor(Date.now() / 1000) + 1800));
    params.set("line_items[0][price_data][currency]", currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(amountMinor));
    params.set(
      "line_items[0][price_data][product_data][name]",
      paymentChoice === "deposit"
        ? `${template.name} deposit`
        : template.name
    );
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[payment_id]", paymentId);
    params.set("metadata[business_id]", business.id);
    params.set("metadata[package_sale_id]", saleId);
    params.set("metadata[package_template_id]", template.id);
    params.set("metadata[package_sale_source]", "public");
    params.set("payment_intent_data[metadata][payment_id]", paymentId);
    params.set("payment_intent_data[metadata][business_id]", business.id);
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
        "Unable to create secure payment."
      );

      await env.DB.prepare(`
        UPDATE package_sales
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind(saleId, business.id).run();

      await env.DB.prepare(`
        UPDATE payments
        SET status = 'failed', notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind(message.slice(0, 1000), paymentId, business.id).run();

      return Response.json({ ok: false, error: message }, { status: 502 });
    }

    await env.DB.prepare(`
      UPDATE package_sales
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(result.data.id, saleId, business.id).run();

    await env.DB.prepare(`
      UPDATE payments
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(result.data.id, paymentId, business.id).run();

    return Response.json({
      ok: true,
      sale_id: saleId,
      checkout_url: result.data.url
    });
  } catch (error) {
    console.error("Public package purchase failed:", error);
    return Response.json(
      { ok: false, error: "Unable to start package purchase." },
      { status: 500 }
    );
  }
}
