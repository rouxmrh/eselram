import {
  getPublicBusiness,
  deleteUnusedCustomer
} from "../../../lib/public-booking.js";

export async function onRequestPost({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json({ ok:false, error:"Business unavailable." }, { status:404 });
    }

    const body = await request.json().catch(() => ({}));
    const saleId = String(body.sale_id || "").trim();
    if (!saleId) {
      return Response.json({ ok:false, error:"Sale id is required." }, { status:400 });
    }

    const sale = await env.DB.prepare(`
      SELECT
        ps.id,
        ps.payment_id,
        ps.customer_id,
        ps.status,
        CASE
          WHEN c.id IS NOT NULL
               AND ABS((julianday(ps.created_at) - julianday(c.created_at)) * 86400) <= 120
          THEN 1 ELSE 0
        END AS customer_created_for_checkout
      FROM package_sales ps
      LEFT JOIN customers c
        ON c.id = ps.customer_id
       AND c.business_id = ps.business_id
      WHERE
        ps.id = ?
        AND ps.business_id = ?
        AND ps.source = 'public'
      LIMIT 1
    `).bind(saleId, business.id).first();

    if (!sale) {
      return Response.json({ ok:true, removed:false });
    }

    // Never remove a completed sale or any payment Stripe has confirmed paid.
    if (String(sale.status || '') === 'paid') {
      return Response.json({ ok:true, removed:false });
    }

    if (sale.payment_id) {
      const paid = await env.DB.prepare(`
        SELECT 1 AS found
        FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND status IN ('paid', 'partially_refunded', 'refunded')
          AND payment_type != 'refund'
        LIMIT 1
      `).bind(sale.payment_id, business.id).first();

      if (paid) {
        return Response.json({ ok:true, removed:false });
      }
    }

    await env.DB.prepare(`
      DELETE FROM package_sales
      WHERE
        id = ?
        AND business_id = ?
        AND source = 'public'
        AND status IN ('pending', 'failed')
    `).bind(saleId, business.id).run();

    if (sale.payment_id) {
      await env.DB.prepare(`
        DELETE FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `).bind(sale.payment_id, business.id).run();
    }

    if (sale.customer_id && Number(sale.customer_created_for_checkout || 0) === 1) {
      await deleteUnusedCustomer(env, business.id, sale.customer_id);
    }

    return Response.json({ ok:true, removed:true });
  } catch (error) {
    console.error("Public package cancellation cleanup failed:", error);
    return Response.json({ ok:false, error:"Unable to clear cancelled package purchase." }, { status:500 });
  }
}
