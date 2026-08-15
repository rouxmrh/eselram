import {
  getPublicBusiness
} from "../../../lib/public-booking.js";

export async function onRequestGet({ env }) {
  try {
    const business = await getPublicBusiness(env);

    if (!business) {
      return Response.json(
        { ok: false, error: "Business is unavailable." },
        { status: 404 }
      );
    }

    const rows = await env.DB.prepare(`
      SELECT
        pt.id,
        pt.name,
        pt.description,
        pt.sessions_total,
        pt.price_minor,
        pt.deposit_minor,
        pt.validity_days,
        s.id AS service_id,
        s.name AS service_name,
        s.requires_consultation,
        s.requires_patch_test,
        s.post_consultation_booking
      FROM package_templates pt
      JOIN services s ON s.id = pt.service_id
      WHERE
        pt.business_id = ?
        AND pt.is_active = 1
        AND pt.is_public = 1
        AND s.is_active = 1
        AND (
          s.requires_consultation = 0
          OR s.post_consultation_booking = 'client_can_book'
        )
      ORDER BY pt.name COLLATE NOCASE
    `).bind(business.id).all();

    return Response.json({
      ok: true,
      business: {
        name: business.name,
        currency: business.currency || "GBP"
      },
      packages: rows.results || []
    });
  } catch (error) {
    console.error("Public packages config failed:", error);
    return Response.json(
      { ok: false, error: "Unable to load packages." },
      { status: 500 }
    );
  }
}
