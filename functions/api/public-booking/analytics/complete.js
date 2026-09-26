import { getPublicBusiness } from "../../../../lib/public-booking.js";

function clean(value, max = 300) { return String(value || "").trim().slice(0, max); }
function validSessionToken(value) { return /^[A-Za-z0-9_-]{16,120}$/.test(value); }

export async function onRequestPost({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) return Response.json({ ok: false }, { status: 404 });
    const body = await request.json();
    const sessionToken = clean(body.session_token, 120);
    const appointmentId = clean(body.appointment_id, 160);
    if (!validSessionToken(sessionToken) || !appointmentId) {
      return Response.json({ ok: false }, { status: 400 });
    }
    const session = await env.DB.prepare(`
      SELECT id, first_source, first_medium, first_campaign, referrer
      FROM analytics_sessions
      WHERE business_id = ? AND session_token = ? LIMIT 1
    `).bind(business.id, sessionToken).first();
    if (!session) return Response.json({ ok: true });

    const appointment = await env.DB.prepare(`
      SELECT id, service_id, status
      FROM appointments
      WHERE id = ? AND business_id = ? LIMIT 1
    `).bind(appointmentId, business.id).first();
    if (!appointment || appointment.status !== "confirmed") return Response.json({ ok: true });

    const existing = await env.DB.prepare(`
      SELECT id FROM analytics_attribution
      WHERE business_id = ? AND appointment_id = ? LIMIT 1
    `).bind(business.id, appointmentId).first();

    const payment = await env.DB.prepare(`
      SELECT id FROM payments
      WHERE business_id = ? AND appointment_id = ?
        AND status IN ('paid','partially_refunded','refunded')
      ORDER BY created_at DESC LIMIT 1
    `).bind(business.id, appointmentId).first();

    if (!existing) {
      await env.DB.prepare(`
        INSERT INTO analytics_attribution (
          id, business_id, analytics_session_id, appointment_id, payment_id,
          source, medium, campaign, referrer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `aa_${crypto.randomUUID()}`, business.id, session.id, appointmentId,
        payment?.id || null, session.first_source || "direct", session.first_medium || null,
        session.first_campaign || null, session.referrer || null
      ).run();

      await env.DB.prepare(`
        INSERT INTO analytics_events (
          id, business_id, analytics_session_id, event_type,
          service_id, source, medium, campaign
        ) VALUES (?, ?, ?, 'booking_complete', ?, ?, ?, ?)
      `).bind(
        `ae_${crypto.randomUUID()}`, business.id, session.id, appointment.service_id || null,
        session.first_source || "direct", session.first_medium || null, session.first_campaign || null
      ).run();
    } else if (payment?.id) {
      await env.DB.prepare(`
        UPDATE analytics_attribution SET payment_id = ?
        WHERE id = ? AND payment_id IS NULL
      `).bind(payment.id, existing.id).run();
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Public booking analytics completion failed:", error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
