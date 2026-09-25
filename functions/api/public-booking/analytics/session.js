import { getPublicBusiness } from "../../../../lib/public-booking.js";

function clean(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function validSessionToken(value) {
  return /^[A-Za-z0-9_-]{16,120}$/.test(value);
}

function normaliseSource(value) {
  const source = clean(value, 80).toLowerCase().replace(/\s+/g, "-");
  const aliases = {
    ig: "instagram",
    insta: "instagram",
    instagram: "instagram",
    fb: "facebook",
    facebook: "facebook",
    web: "website",
    website: "website",
    googlebusiness: "google",
    "google-business": "google",
    google: "google",
  };
  return aliases[source] || source || "direct";
}

export async function onRequestPost({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json(
        { ok: false, error: "This booking page is not configured." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const sessionToken = clean(body.session_token, 120);

    if (!validSessionToken(sessionToken)) {
      return Response.json(
        { ok: false, error: "Invalid analytics session." },
        { status: 400 }
      );
    }

    const source = normaliseSource(body.source);
    const medium = clean(body.medium, 80) || null;
    const campaign = clean(body.campaign, 120) || null;
    const content = clean(body.content, 120) || null;
    const landingPage = clean(body.landing_page, 300) || "/book";
    const referrer = clean(body.referrer, 500) || null;

    const existing = await env.DB
      .prepare(`
        SELECT id
        FROM analytics_sessions
        WHERE business_id = ? AND session_token = ?
        LIMIT 1
      `)
      .bind(business.id, sessionToken)
      .first();

    let analyticsSessionId = existing?.id || null;

    if (analyticsSessionId) {
      await env.DB
        .prepare(`
          UPDATE analytics_sessions
          SET last_seen_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `)
        .bind(analyticsSessionId, business.id)
        .run();
    } else {
      analyticsSessionId = `as_${crypto.randomUUID()}`;

      await env.DB
        .prepare(`
          INSERT INTO analytics_sessions (
            id,
            business_id,
            session_token,
            first_source,
            first_medium,
            first_campaign,
            first_content,
            landing_page,
            referrer
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          analyticsSessionId,
          business.id,
          sessionToken,
          source,
          medium,
          campaign,
          content,
          landingPage,
          referrer
        )
        .run();
    }

    // Avoid inflating visits when the booking router/return flow reloads the page
    // more than once in a few seconds. A genuine later visit is still counted.
    const recentPageView = await env.DB
      .prepare(`
        SELECT id
        FROM analytics_events
        WHERE business_id = ?
          AND analytics_session_id = ?
          AND event_type = 'booking_page_view'
          AND datetime(created_at) >= datetime('now', '-10 seconds')
        LIMIT 1
      `)
      .bind(business.id, analyticsSessionId)
      .first();

    if (!recentPageView) {
      await env.DB
        .prepare(`
          INSERT INTO analytics_events (
            id,
            business_id,
            analytics_session_id,
            event_type,
            source,
            medium,
            campaign
          ) VALUES (?, ?, ?, 'booking_page_view', ?, ?, ?)
        `)
        .bind(
          `ae_${crypto.randomUUID()}`,
          business.id,
          analyticsSessionId,
          source,
          medium,
          campaign
        )
        .run();
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Public booking analytics session failed:", error);
    // Analytics must never block or break the public booking journey.
    return Response.json({ ok: false }, { status: 200 });
  }
}
