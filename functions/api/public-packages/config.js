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

    const [packageRows, variantRows, branding] = await Promise.all([
      env.DB.prepare(`
        SELECT
          pt.id,
          pt.name,
          pt.description,
          pt.sessions_total,
          pt.price_minor,
          pt.payment_rule,
          pt.deposit_minor,
          pt.validity_days,
          s.id AS service_id,
          s.name AS service_name,
          s.requires_consultation,
          s.requires_patch_test,
          s.post_consultation_booking
        FROM package_templates pt
        JOIN services s
          ON s.id = pt.service_id
         AND s.business_id = pt.business_id
        WHERE
          pt.business_id = ?
          AND pt.is_active = 1
          AND pt.is_public = 1
          AND s.is_active = 1
          AND pt.payment_rule <> 'pay_later'
        ORDER BY pt.name COLLATE NOCASE
      `).bind(business.id).all(),

      env.DB.prepare(`
        SELECT
          pv.id,
          pv.package_template_id,
          pv.service_id,
          pv.name,
          pv.price_minor,
          pv.payment_rule,
          pv.deposit_minor,
          s.name AS service_name,
          s.requires_consultation,
          s.requires_patch_test,
          s.post_consultation_booking
        FROM package_variants pv
        JOIN services s
          ON s.id = pv.service_id
         AND s.business_id = pv.business_id
        JOIN package_templates pt
          ON pt.id = pv.package_template_id
         AND pt.business_id = pv.business_id
        WHERE
          pv.business_id = ?
          AND pv.is_active = 1
          AND pt.is_active = 1
          AND pt.is_public = 1
          AND s.is_active = 1
          AND pv.payment_rule <> 'pay_later'
          AND (
            s.requires_consultation = 0
            OR s.post_consultation_booking = 'client_can_book'
          )
        ORDER BY
          pv.package_template_id,
          pv.sort_order,
          pv.name COLLATE NOCASE
      `).bind(business.id).all(),

      env.DB.prepare(`
        SELECT primary_colour
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `).bind(business.id).first()
    ]);

    const variants = variantRows.results || [];

    const packages = (packageRows.results || [])
      .map(item => {
        const itemVariants =
          variants.filter(
            variant =>
              variant.package_template_id === item.id
          );

        const baseEligible =
          Number(item.requires_consultation || 0) === 0 ||
          String(
            item.post_consultation_booking ||
            "client_can_book"
          ) === "client_can_book";

        if (!itemVariants.length && !baseEligible) {
          return null;
        }

        return {
          ...item,
          variants: itemVariants
        };
      })
      .filter(Boolean);

    return Response.json({
      ok: true,
      business: {
        name: business.name,
        currency: business.currency || "GBP"
      },
      branding: {
        primary_colour:
          branding?.primary_colour ||
          "#365178"
      },
      packages
    });
  } catch (error) {
    console.error("Public packages config failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load packages." },
      { status: 500 }
    );
  }
}
