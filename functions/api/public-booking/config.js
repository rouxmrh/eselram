import {
  getPublicBusiness,
  cleanupPendingOnlineBookings,
  getPublicBookingRules,
  serverError
} from "../../../lib/public-booking.js";

export async function onRequestGet({ env }) {
  try {
    const business = await getPublicBusiness(env);

    if (!business) {
      return Response.json(
        { ok: false, error: "This booking page is not configured." },
        { status: 404 }
      );
    }

    await cleanupPendingOnlineBookings(env, business.id);

    const publicBookingRules =
      await getPublicBookingRules(
        env,
        business.id
      );

    const [branding, services, stripeIntegration] = await Promise.all([
      env.DB
        .prepare(`
          SELECT
            logo_data_url,
            primary_colour,
            accent_colour,
            background_colour,
            surface_colour,
            text_colour,
            form_style,
            logo_position,
            show_business_name,
            show_contact_details,
            footer_text
          FROM business_branding
          WHERE business_id = ?
          LIMIT 1
        `)
        .bind(business.id)
        .first(),

      env.DB
        .prepare(`
          SELECT
            s.id,
            s.name,
            s.description,
            s.duration_minutes,
            s.price_minor,
            s.deposit_minor,
            s.payment_timing,
            s.requires_consultation,
            s.requires_patch_test,
            s.sort_order,
            EXISTS (
              SELECT 1
              FROM service_payment_providers spp
              WHERE
                spp.service_id = s.id
                AND spp.provider_key = 'stripe'
            ) AS stripe_allowed
          FROM services s
          WHERE
            s.business_id = ?
            AND s.is_active = 1
          ORDER BY s.sort_order ASC, s.name COLLATE NOCASE ASC
        `)
        .bind(business.id)
        .all(),

      env.DB
        .prepare(`
          SELECT status
          FROM business_integrations
          WHERE
            business_id = ?
            AND integration_type = 'payments'
            AND provider = 'stripe'
          LIMIT 1
        `)
        .bind(business.id)
        .first()
    ]);

    const stripeReady = stripeIntegration?.status === "verified";

    const publicServices = (services.results || []).map((service) => {
      const requiresOnlinePayment =
        service.payment_timing === "online_deposit" ||
        service.payment_timing === "online_full";

      return {
        id: service.id,
        name: service.name,
        description: service.description,
        duration_minutes: Number(service.duration_minutes || 0),
        price_minor: Number(service.price_minor || 0),
        deposit_minor: Number(service.deposit_minor || 0),
        payment_timing: service.payment_timing,
        requires_consultation: Number(service.requires_consultation || 0),
        requires_patch_test: Number(service.requires_patch_test || 0),
        online_booking_available:
          !requiresOnlinePayment ||
          (Number(service.stripe_allowed || 0) === 1 && stripeReady),
        unavailable_reason:
          requiresOnlinePayment &&
          !(Number(service.stripe_allowed || 0) === 1 && stripeReady)
            ? "Online payment is not currently available for this service."
            : null
      };
    });

    return Response.json({
      ok: true,
      business: {
        name: business.name,
        email: business.email,
        phone: business.phone,
        website: business.website,
        timezone: business.timezone,
        currency: business.currency,
        locale: business.locale
      },
      branding: branding || {
        logo_data_url: null,
        primary_colour: "#365c50",
        accent_colour: "#6f8079",
        background_colour: "#f5f4ef",
        surface_colour: "#ffffff",
        text_colour: "#18221f",
        form_style: "soft",
        logo_position: "centre",
        show_business_name: 1,
        show_contact_details: 1,
        footer_text: null
      },
      booking_rules: {
        enabled:
          publicBookingRules.enabled,

        minimum_notice_hours:
          publicBookingRules.minimum_notice_hours,

        max_advance_days:
          publicBookingRules.max_advance_days
      },

      services:
        publicBookingRules.enabled
          ? publicServices
          : []
    });
  } catch (error) {
    console.error("Public booking config failed:", error);
    return serverError("Unable to load the booking page.");
  }
}
