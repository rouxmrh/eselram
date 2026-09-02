import {
  getPublicBusiness
} from "../../../lib/public-booking.js";

import {
  confirmPublicPackagePayment
} from "../../../lib/public-package-payment.js";

async function loadSale(env, businessId, saleId) {
  return await env.DB.prepare(`
    SELECT
      ps.id,
      ps.status,
      ps.payment_choice,
      ps.amount_minor,
      ps.currency,
      ps.customer_package_id,
      ps.customer_id,
      ps.consultation_credit_minor,
      ps.package_variant_id,
      ps.provider_reference,
      CASE
        WHEN pv.id IS NOT NULL THEN pt.name || ' · ' || pv.name
        ELSE pt.name
      END AS package_name,
      pt.sessions_total,
      COALESCE(pv.service_id, pt.service_id) AS service_id,
      COALESCE(vs.name, s.name) AS service_name,
      COALESCE(vs.requires_consultation, s.requires_consultation) AS requires_consultation
    FROM package_sales ps
    JOIN package_templates pt ON pt.id = ps.package_template_id
    LEFT JOIN package_variants pv
      ON pv.id = ps.package_variant_id
     AND pv.package_template_id = pt.id
    JOIN services s
      ON s.id = pt.service_id
     AND s.business_id = pt.business_id
    LEFT JOIN services vs
      ON vs.id = pv.service_id
     AND vs.business_id = pt.business_id
    WHERE ps.id = ? AND ps.business_id = ? AND ps.source = 'public'
    LIMIT 1
  `).bind(saleId, businessId).first();
}

export async function onRequestGet({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json({ ok: false, error: "Business unavailable." }, { status: 404 });
    }

    const url = new URL(request.url);
    const saleId = String(url.searchParams.get("sale_id") || "").trim();
    if (!saleId) {
      return Response.json({ ok: false, error: "Sale id is required." }, { status: 400 });
    }

    let sale = await loadSale(env, business.id, saleId);
    if (!sale) {
      return Response.json({ ok: false, error: "Package purchase not found." }, { status: 404 });
    }

    // Self-heal a successful Stripe checkout even if a webhook was unavailable
    // or the first browser-return confirmation attempt was interrupted.
    if (sale.status === "pending" && String(sale.provider_reference || "").startsWith("cs_")) {
      const confirmed = await confirmPublicPackagePayment({
        env,
        saleId,
        sessionId: sale.provider_reference,
        businessId: business.id,
        baseUrl: url.origin,
        sendReceipt: true
      });

      if (confirmed.ok) {
        sale = await loadSale(env, business.id, saleId) || sale;
      }
    }

    return Response.json({
      ok: true,
      sale,
      business: {
        name: business.name,
        website: business.website || null
      }
    });
  } catch (error) {
    console.error("Public package status failed:", error);
    return Response.json({ ok: false, error: "Unable to check purchase." }, { status: 500 });
  }
}
