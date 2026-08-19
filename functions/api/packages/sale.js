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

import {
  sendPaymentReceipt
} from "../../../lib/communications.js";

import {
  finalizePackageSale
} from "../../../lib/package-sales.js";


async function getUserContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);

  return await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.business_id,
      b.name AS business_name,
      b.website,
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


function safeBusinessWebsite(
  value
) {
  const raw =
    String(
      value ||
      ""
    ).trim();

  if (!raw) {
    return "";
  }

  let parsed;

  try {
    parsed =
      new URL(
        raw
      );
  } catch {
    try {
      parsed =
        new URL(
          `https://${raw}`
        );
    } catch {
      return "";
    }
  }

  if (
    ![
      "http:",
      "https:"
    ].includes(
      parsed.protocol
    )
  ) {
    return "";
  }

  return parsed.toString();
}


async function cancelPendingPackageSale({
  env,
  integration,
  businessId,
  sale
}) {
  if (
    !sale ||
    sale.status !== "pending"
  ) {
    return false;
  }

  const providerReference =
    String(
      sale.provider_reference ||
      ""
    ).trim();

  if (providerReference) {
    try {
      const result =
        await stripeRequest({
          secretKey:
            integration.secretKey,
          path:
            `/v1/checkout/sessions/${encodeURIComponent(providerReference)}/expire`,
          method:
            "POST"
        });

      if (
        !result.response.ok
      ) {
        // If Stripe refuses to expire it because it has already completed,
        // leave the local sale untouched. The webhook remains authoritative.
        return false;
      }
    } catch (error) {
      console.error(
        "Unable to expire superseded package checkout:",
        error
      );

      return false;
    }
  }

  /*
   * An expired, unpaid Checkout session is not a financial transaction.
   * Remove the temporary package-sale/payment rows instead of turning an
   * abandoned checkout into a red "Failed" payment in Finance Centre.
   */
  await env.DB.prepare(`
    DELETE FROM package_sales
    WHERE
      id = ?
      AND business_id = ?
      AND status = 'pending'
  `).bind(
    sale.id,
    businessId
  ).run();

  if (sale.payment_id) {
    await env.DB.prepare(`
      DELETE FROM payments
      WHERE
        id = ?
        AND business_id = ?
        AND status = 'pending'
    `).bind(
      sale.payment_id,
      businessId
    ).run();
  }

  return true;
}


async function cancelSupersededPackageSales({
  env,
  integration,
  businessId,
  customerId
}) {
  const rows =
    await env.DB.prepare(`
      SELECT
        ps.id,
        ps.payment_id,
        ps.provider_reference,
        ps.status
      FROM package_sales ps
      LEFT JOIN payments p
        ON p.id = ps.payment_id
       AND p.business_id = ps.business_id
      WHERE
        ps.business_id = ?
        AND ps.customer_id = ?
        AND ps.source = 'staff'
        AND ps.status = 'pending'
        AND COALESCE(
          p.status,
          'pending'
        ) = 'pending'
      ORDER BY
        datetime(
          ps.created_at
        ) DESC
    `).bind(
      businessId,
      customerId
    ).all();

  for (
    const sale of
      rows.results ||
      []
  ) {
    await cancelPendingPackageSale({
      env,
      integration,
      businessId,
      sale
    });
  }
}



export async function onRequestGet({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return Response.json(
        {
          ok: false,
          error:
            "Authentication required."
        },
        {
          status: 401
        }
      );
    }

    const url =
      new URL(
        request.url
      );

    const saleId =
      String(
        url.searchParams.get(
          "sale_id"
        ) ||
        ""
      ).trim();

    if (!saleId) {
      return badRequest(
        "Package sale is required."
      );
    }

    const sale =
      await env.DB.prepare(`
        SELECT
          ps.id,
          ps.payment_id,
          ps.provider_reference,
          ps.customer_package_id,
          ps.status,
          p.status AS payment_status
        FROM package_sales ps
        LEFT JOIN payments p
          ON p.id = ps.payment_id
         AND p.business_id = ps.business_id
        WHERE
          ps.id = ?
          AND ps.business_id = ?
          AND ps.source = 'staff'
        LIMIT 1
      `).bind(
        saleId,
        user.business_id
      ).first();

    if (!sale) {
      return Response.json(
        {
          ok: false,
          error:
            "Package sale not found."
        },
        {
          status: 404
        }
      );
    }

    if (
      sale.status === "paid" &&
      sale.customer_package_id
    ) {
      return Response.json({
        ok: true,
        status: "paid",
        customer_package_id:
          sale.customer_package_id,
        payment_id:
          sale.payment_id || null
      });
    }

    if (
      sale.status !== "pending" ||
      !sale.provider_reference ||
      !sale.payment_id
    ) {
      return Response.json({
        ok: true,
        status:
          sale.status,
        customer_package_id:
          sale.customer_package_id ||
          null,
        payment_id:
          sale.payment_id ||
          null
      });
    }

    const integration =
      await getBusinessStripeIntegration(
        env,
        user.business_id
      );

    if (
      integration.error ||
      integration.row.status !==
        "verified"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            integration.error ||
            "Stripe is unavailable."
        },
        {
          status: 503
        }
      );
    }

    const result =
      await stripeRequest({
        secretKey:
          integration.secretKey,
        path:
          `/v1/checkout/sessions/${encodeURIComponent(
            sale.provider_reference
          )}`
      });

    if (!result.response.ok) {
      return Response.json(
        {
          ok: false,
          error:
            stripeErrorMessage(
              result.data,
              "Unable to verify package payment."
            )
        },
        {
          status: 502
        }
      );
    }

    const session =
      result.data || {};

    if (
      String(
        session?.metadata
          ?.package_sale_id ||
        ""
      ) !== sale.id ||
      String(
        session?.metadata
          ?.business_id ||
        ""
      ) !== user.business_id
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Stripe package payment reference did not match this sale."
        },
        {
          status: 409
        }
      );
    }

    if (
      session.payment_status ===
      "paid"
    ) {
      await env.DB.prepare(`
        UPDATE payments
        SET
          status = 'paid',
          provider_reference = ?,
          payment_method = ?,
          paid_at =
            COALESCE(
              paid_at,
              CURRENT_TIMESTAMP
            ),
          notes =
            'Stripe package payment confirmed directly',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE
          id = ?
          AND business_id = ?
      `).bind(
        session.id,
        String(
          session.payment_method_types?.[0] ||
          "card"
        ),
        sale.payment_id,
        user.business_id
      ).run();

      const finalized =
        await finalizePackageSale({
          env,
          session,
          paid: true
        });

      try {
        await sendPaymentReceipt({
          env,
          businessId:
            user.business_id,
          paymentId:
            sale.payment_id
        });
      } catch (error) {
        console.error(
          "Package payment confirmation email failed:",
          error
        );
      }

      return Response.json({
        ok: true,
        status: "paid",
        customer_package_id:
          finalized
            ?.customer_package_id ||
          null,
        payment_id:
          sale.payment_id
      });
    }

    if (
      session.status ===
      "expired"
    ) {
      return Response.json({
        ok: true,
        status: "failed",
        payment_id:
          sale.payment_id
      });
    }

    return Response.json({
      ok: true,
      status: "pending",
      payment_id:
        sale.payment_id
    });

  } catch (error) {
    console.error(
      "Package sale status failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to verify package payment."
      },
      {
        status: 500
      }
    );
  }
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
    const variantId = String(body.package_variant_id || "").trim();
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
        pt.id,
        pt.service_id,
        pt.name,
        pt.sessions_total,
        pt.price_minor,
        pt.payment_rule,
        pt.deposit_minor,
        pt.validity_days,
        pt.is_active,
        s.requires_consultation
      FROM package_templates pt
      JOIN services s
        ON s.id = pt.service_id
       AND s.business_id = pt.business_id
      WHERE
        pt.id = ?
        AND pt.business_id = ?
      LIMIT 1
    `).bind(templateId, user.business_id).first();

    if (!template || Number(template.is_active) !== 1) {
      return badRequest("Package is unavailable.");
    }

    const variantRows = await env.DB.prepare(`
      SELECT
        pv.id,
        pv.service_id,
        pv.name,
        pv.price_minor,
        pv.payment_rule,
        pv.deposit_minor,
        s.requires_consultation
      FROM package_variants pv
      JOIN services s
        ON s.id = pv.service_id
       AND s.business_id = pv.business_id
      WHERE
        pv.package_template_id = ?
        AND pv.business_id = ?
        AND pv.is_active = 1
      ORDER BY pv.sort_order, pv.name COLLATE NOCASE
    `).bind(template.id, user.business_id).all();

    const variants = variantRows.results || [];

    if (variants.length > 0 && !variantId) {
      return badRequest("Choose a package variant.");
    }

    const variant =
      variantId
        ? variants.find(item => item.id === variantId)
        : null;

    if (variantId && !variant) {
      return badRequest("Selected package variant is unavailable.");
    }

    const resolvedServiceId =
      variant?.service_id ||
      template.service_id;

    const resolvedPriceMinor =
      Math.max(
        0,
        Number(
          variant?.price_minor ??
          template.price_minor ??
          0
        )
      );

    const resolvedDepositMinor =
      Math.max(
        0,
        Number(
          variant?.deposit_minor ??
          template.deposit_minor ??
          0
        )
      );

    const resolvedPaymentRule =
      String(
        variant?.payment_rule ??
        template.payment_rule ??
        (
          resolvedDepositMinor > 0
            ? "deposit"
            : "full"
        )
      );

    const resolvedName =
      variant
        ? `${template.name} · ${variant.name}`
        : template.name;

    const requiresConsultation =
      Number(
        variant?.requires_consultation ??
        template.requires_consultation ??
        0
      );

    if (
      resolvedPaymentRule === "full" &&
      paymentChoice !== "full"
    ) {
      return badRequest("This package requires full payment.");
    }

    if (
      resolvedPaymentRule === "deposit" &&
      !["deposit", "full"].includes(
        paymentChoice
      )
    ) {
      return badRequest(
        "Choose either the configured deposit or full payment for this package."
      );
    }

    if (resolvedPaymentRule === "pay_later") {
      return badRequest(
        "This package is configured for staff-managed payment. Assign it first, then record payment against the customer package."
      );
    }

    const price = resolvedPriceMinor;
    const deposit =
      resolvedPaymentRule === "deposit"
        ? resolvedDepositMinor
        : 0;

    const integration =
      await getBusinessStripeIntegration(
        env,
        user.business_id
      );

    if (integration.error) {
      return Response.json(
        { ok: false, error: integration.error },
        { status: 503 }
      );
    }

    if (
      integration.row.status !==
      "verified"
    ) {
      return badRequest(
        "Test the Stripe connection in Settings → Payments before taking package payments."
      );
    }

    // Starting a new staff checkout for the same package supersedes any
    // unfinished checkout. An abandoned pending sale must not permanently
    // reserve the customer's one-time consultation credit.
    await cancelSupersededPackageSales({
      env,
      integration,
      businessId:
        user.business_id,
      customerId:
        customer.id
    });

    const availableCredit =
      await findAvailableConsultationCredit({
        env,
        businessId: user.business_id,
        customerId: customer.id,
        serviceId: resolvedServiceId
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
          id, business_id, customer_id, package_template_id, package_variant_id, service_id,
          name_snapshot, sessions_total, price_minor, status,
          starts_on, expires_on, notes
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', date('now'),
          CASE WHEN ? > 0 THEN date('now', '+' || ? || ' days') ELSE NULL END,
          'Created from package sale using consultation credit'
        )
      `).bind(
        customerPackageId,
        user.business_id,
        customer.id,
        template.id,
        variant?.id || null,
        resolvedServiceId,
        resolvedName,
        template.sessions_total,
        price,
        validityDays,
        validityDays
      ).run();

      await env.DB.prepare(`
        INSERT INTO package_sales (
          id, business_id, customer_id, package_template_id, package_variant_id,
          source, payment_choice, amount_minor, currency,
          status, payment_id, customer_package_id, created_by_user_id,
          paid_at, consultation_credit_source_appointment_id,
          consultation_credit_minor
        )
        VALUES (
          ?, ?, ?, ?, ?, 'staff', ?, 0, ?, 'paid', NULL, ?, ?,
          CURRENT_TIMESTAMP, ?, ?
        )
      `).bind(
        saleId,
        user.business_id,
        customer.id,
        template.id,
        variant?.id || null,
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
      `Package sale: ${resolvedName} · consultation credit ${consultationCreditMinor}`
    ).run();

    await env.DB.prepare(`
      INSERT INTO package_sales (
        id, business_id, customer_id, package_template_id, package_variant_id,
        source, payment_choice, amount_minor, currency,
        status, payment_id, created_by_user_id,
        consultation_credit_source_appointment_id, consultation_credit_minor
      )
      VALUES (?, ?, ?, ?, ?, 'staff', ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(
      saleId,
      user.business_id,
      customer.id,
      template.id,
      variant?.id || null,
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

    const businessWebsite =
      safeBusinessWebsite(
        user.website
      );

    const returnQuery =
      new URLSearchParams({
        business:
          user.business_name ||
          "the business",
        website:
          businessWebsite
      });

    params.set(
      "success_url",
      `${origin}/payment-result/?status=success&package_sale_id=${encodeURIComponent(
        saleId
      )}&session_id={CHECKOUT_SESSION_ID}&${returnQuery.toString()}`
    );
    params.set(
      "cancel_url",
      `${origin}/payment-result/?status=cancelled&${returnQuery.toString()}`
    );
    params.set("customer_email", customer.email);
    params.set("client_reference_id", saleId);
    params.set("line_items[0][price_data][currency]", stripeCurrency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(amountMinor));
    params.set(
      "line_items[0][price_data][product_data][name]",
      paymentChoice === "deposit"
        ? `${resolvedName} deposit`
        : resolvedName
    );
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[payment_id]", paymentId);
    params.set("metadata[business_id]", user.business_id);
    params.set("metadata[package_sale_id]", saleId);
    params.set("metadata[package_template_id]", template.id);
    if (variant?.id) {
      params.set("metadata[package_variant_id]", variant.id);
    }
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

      /*
       * Stripe could not create the Checkout session, so no payment attempt
       * actually exists. Remove the temporary records instead of polluting
       * Payment activity with a technical "Failed" transaction.
       */
      await env.DB.prepare(`
        DELETE FROM package_sales
        WHERE id = ? AND business_id = ?
      `).bind(
        saleId,
        user.business_id
      ).run();

      await env.DB.prepare(`
        DELETE FROM payments
        WHERE id = ? AND business_id = ? AND status = 'pending'
      `).bind(
        paymentId,
        user.business_id
      ).run();

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
      payment_id: paymentId,
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


export async function onRequestDelete({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return Response.json(
        {
          ok: false,
          error:
            "Authentication required."
        },
        {
          status: 401
        }
      );
    }

    const body =
      await request.json();

    const saleId =
      String(
        body.sale_id ||
        ""
      ).trim();

    if (!saleId) {
      return badRequest(
        "Package sale is required."
      );
    }

    const sale =
      await env.DB.prepare(`
        SELECT
          id,
          payment_id,
          provider_reference,
          status
        FROM package_sales
        WHERE
          id = ?
          AND business_id = ?
          AND source = 'staff'
        LIMIT 1
      `).bind(
        saleId,
        user.business_id
      ).first();

    if (!sale) {
      return Response.json({
        ok: true,
        already_closed: true
      });
    }

    if (
      sale.status !==
      "pending"
    ) {
      return Response.json({
        ok: true,
        already_closed: true
      });
    }

    const integration =
      await getBusinessStripeIntegration(
        env,
        user.business_id
      );

    if (
      integration.error ||
      integration.row.status !==
        "verified"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            integration.error ||
            "Stripe is unavailable."
        },
        {
          status: 503
        }
      );
    }

    const cancelled =
      await cancelPendingPackageSale({
        env,
        integration,
        businessId:
          user.business_id,
        sale
      });

    return Response.json({
      ok: true,
      cancelled
    });

  } catch (error) {
    console.error(
      "Package sale cancellation failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to cancel package checkout."
      },
      {
        status: 500
      }
    );
  }
}
