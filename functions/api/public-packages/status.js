import {
  getPublicBusiness
} from "../../../lib/public-booking.js";

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

    const sale = await env.DB.prepare(`
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
        CASE
          WHEN pv.id IS NOT NULL
            THEN pt.name || ' · ' || pv.name
          ELSE pt.name
        END AS package_name,
        pt.sessions_total,
        pt.service_id,
        s.name AS service_name,
        s.requires_consultation
      FROM package_sales ps
      JOIN package_templates pt ON pt.id = ps.package_template_id
      LEFT JOIN package_variants pv
        ON pv.id = ps.package_variant_id
       AND pv.package_template_id = pt.id
      JOIN services s
        ON s.id = pt.service_id
       AND s.business_id = pt.business_id
      WHERE ps.id = ? AND ps.business_id = ? AND ps.source = 'public'
      LIMIT 1
    `).bind(saleId, business.id).first();

    if (!sale) {
      return Response.json({ ok: false, error: "Package purchase not found." }, { status: 404 });
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
