import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "./stripe-business.js";

import {
  sendPaymentReceipt
} from "./communications.js";

import {
  finalizePackageSale
} from "./package-sales.js";

import {
  setDiscountAdjustmentStatus
} from "./payment-discounts.js";

async function getSale(env, saleId, businessId = null) {
  let sql = `
    SELECT
      ps.id,
      ps.business_id,
      ps.payment_id,
      ps.provider_reference,
      ps.customer_package_id,
      ps.status,
      ps.source
    FROM package_sales ps
    WHERE ps.id = ?
      AND ps.source = 'public'
  `;
  const binds = [saleId];
  if (businessId) {
    sql += ` AND ps.business_id = ?`;
    binds.push(businessId);
  }
  sql += ` LIMIT 1`;
  return await env.DB.prepare(sql).bind(...binds).first();
}

export async function confirmPublicPackagePayment({
  env,
  saleId,
  sessionId = null,
  businessId = null,
  baseUrl = null,
  sendReceipt = true
}) {
  const cleanSaleId = String(saleId || "").trim();
  if (!cleanSaleId) {
    return { ok: false, error: "Package sale is required." };
  }

  const sale = await getSale(env, cleanSaleId, businessId);
  if (!sale) {
    return { ok: false, not_found: true, error: "Package purchase was not found." };
  }

  const checkoutSessionId = String(sessionId || sale.provider_reference || "").trim();
  if (!checkoutSessionId.startsWith("cs_")) {
    return {
      ok: true,
      paid: sale.status === "paid",
      status: sale.status || "pending",
      customer_package_id: sale.customer_package_id || null,
      skipped: true,
      reason: "missing_checkout_session"
    };
  }

  const integration = await getBusinessStripeIntegration(env, sale.business_id);
  if (integration.error || integration.row?.status !== "verified") {
    return { ok: false, error: "Stripe verification is temporarily unavailable." };
  }

  const result = await stripeRequest({
    secretKey: integration.secretKey,
    path: `/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`
  });

  if (!result.response.ok) {
    return {
      ok: false,
      error: stripeErrorMessage(result.data, "Unable to verify package payment.")
    };
  }

  const session = result.data || {};
  if (
    String(session?.metadata?.package_sale_id || "") !== sale.id ||
    String(session?.metadata?.business_id || "") !== String(sale.business_id)
  ) {
    return { ok: false, error: "Stripe package payment reference did not match." };
  }

  if (session.payment_status !== "paid") {
    if (session.status === "expired") {
      await env.DB.prepare(`
        UPDATE package_sales
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ? AND status = 'pending'
      `).bind(sale.id, sale.business_id).run();

      if (sale.payment_id) {
        await env.DB.prepare(`
          UPDATE payments
          SET status = 'failed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
            AND status NOT IN ('paid', 'partially_refunded', 'refunded')
        `).bind(sale.payment_id, sale.business_id).run();
      }
    }

    return {
      ok: true,
      paid: false,
      status: session.status || sale.status || "pending"
    };
  }

  // Idempotent: finalise the package first, then make sure the linked payment is paid.
  // Re-running this function is safe and repairs a partially-finalised earlier attempt.
  const finalized = await finalizePackageSale({ env, session, paid: true });

  if (sale.payment_id) {
    await env.DB.prepare(`
      UPDATE payments
      SET
        status = 'paid',
        provider_reference = ?,
        payment_method = ?,
        paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
        notes = CASE
          WHEN COALESCE(notes, '') = '' THEN
            'Stripe public package payment confirmed'
          WHEN instr(COALESCE(notes, ''), 'Stripe public package payment confirmed') > 0 THEN notes
          ELSE notes || ' · Stripe public package payment confirmed'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(
      session.id,
      String(session.payment_method_types?.[0] || "card"),
      sale.payment_id,
      sale.business_id
    ).run();

    await setDiscountAdjustmentStatus({
      env,
      businessId: sale.business_id,
      paymentId: sale.payment_id,
      status: "paid",
      customerPackageId: finalized?.customer_package_id || sale.customer_package_id || null
    });
  }

  let receiptSent = false;
  let receiptError = null;
  if (sendReceipt && sale.payment_id) {
    try {
      const receiptResult = await sendPaymentReceipt({
        env,
        businessId: sale.business_id,
        paymentId: sale.payment_id,
        baseUrl
      });
      receiptSent = Boolean(receiptResult?.ok === true);
      if (!receiptSent) {
        receiptError = receiptResult?.error || receiptResult?.reason || null;
      }
    } catch (error) {
      receiptError = error?.message || "Unable to send package payment confirmation email.";
      console.error("Public package payment confirmation email failed:", error);
    }
  }

  return {
    ok: true,
    paid: true,
    status: "paid",
    customer_package_id: finalized?.customer_package_id || sale.customer_package_id || null,
    receipt_sent: receiptSent,
    receipt_error: receiptError
  };
}

export async function reconcilePendingPublicPackageSales({
  env,
  businessId,
  baseUrl = null,
  limit = 25
}) {
  const rows = await env.DB.prepare(`
    SELECT id, provider_reference
    FROM package_sales
    WHERE business_id = ?
      AND source = 'public'
      AND status = 'pending'
      AND provider_reference LIKE 'cs_%'
    ORDER BY datetime(created_at) ASC
    LIMIT ?
  `).bind(businessId, Math.max(1, Math.min(Number(limit || 25), 100))).all();

  const results = [];
  for (const row of rows.results || []) {
    try {
      results.push(await confirmPublicPackagePayment({
        env,
        saleId: row.id,
        sessionId: row.provider_reference,
        businessId,
        baseUrl,
        sendReceipt: true
      }));
    } catch (error) {
      console.error("Pending public package reconciliation failed:", row.id, error);
      results.push({ ok: false, error: error?.message || "Unable to reconcile package payment." });
    }
  }
  return results;
}
