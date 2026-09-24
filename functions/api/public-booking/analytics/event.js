import { getPublicBusiness } from "../../../../lib/public-booking.js";

function clean(value, max = 300) { return String(value || "").trim().slice(0, max); }
function validSessionToken(value) { return /^[A-Za-z0-9_-]{16,120}$/.test(value); }
const ALLOWED_EVENTS = new Set(["select_service", "begin_booking"]);

export async function onRequestPost({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) return Response.json({ ok: false }, { status: 404 });
    const body = await request.json();
    const sessionToken = clean(body.session_token, 120);
    const eventType = clean(body.event_type, 50);
    if (!validSessionToken(sessionToken) || !ALLOWED_EVENTS.has(eventType)) {
      return Response.json({ ok: false }, { status: 400 });
    }
    const session = await env.DB.prepare(`
      SELECT id, first_source, first_medium, first_campaign
      FROM analytics_sessions
      WHERE business_id = ? AND session_token = ? LIMIT 1
    `).bind(business.id, sessionToken).first();
    if (!session) return Response.json({ ok: true });
    await env.DB.prepare(`
      INSERT INTO analytics_events (
        id, business_id, analytics_session_id, event_type,
        service_id, package_template_id, source, medium, campaign
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `ae_${crypto.randomUUID()}`, business.id, session.id, eventType,
      clean(body.service_id, 120) || null, clean(body.package_template_id, 120) || null,
      session.first_source || "direct", session.first_medium || null, session.first_campaign || null
    ).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Public booking analytics event failed:", error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
