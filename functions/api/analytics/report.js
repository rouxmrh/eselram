import { readSessionToken, hashSessionToken } from "../../../lib/auth.js";

async function context(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  return env.DB.prepare(`
    SELECT u.business_id, b.currency, b.locale, b.timezone
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN businesses b ON b.id = u.business_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();
}

function rangeStart(range) {
  const days = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[range] || 30;
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await context(request, env);
    if (!user) return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
    const url = new URL(request.url);
    const range = ["7d", "30d", "90d", "365d"].includes(url.searchParams.get("range")) ? url.searchParams.get("range") : "30d";
    const since = rangeStart(range);
    const businessId = user.business_id;

    const [visits, selected, started, bookings, revenue, sources, campaigns, services] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS count FROM analytics_sessions WHERE business_id = ? AND datetime(first_seen_at) >= datetime(?)`).bind(businessId, since).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT analytics_session_id) AS count FROM analytics_events WHERE business_id = ? AND event_type='select_service' AND datetime(created_at) >= datetime(?)`).bind(businessId, since).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT analytics_session_id) AS count FROM analytics_events WHERE business_id = ? AND event_type='begin_booking' AND datetime(created_at) >= datetime(?)`).bind(businessId, since).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM analytics_attribution WHERE business_id = ? AND datetime(attributed_at) >= datetime(?)`).bind(businessId, since).first(),
      env.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN p.payment_type='refund' THEN -p.amount_minor ELSE p.amount_minor END),0) AS amount_minor
        FROM analytics_attribution aa
        JOIN payments p ON p.id = aa.payment_id AND p.business_id = aa.business_id
        WHERE aa.business_id = ? AND datetime(aa.attributed_at) >= datetime(?)
          AND p.status IN ('paid','partially_refunded','refunded')
      `).bind(businessId, since).first(),
      env.DB.prepare(`
        SELECT COALESCE(aa.source,'direct') AS source,
          COUNT(*) AS bookings,
          COUNT(DISTINCT aa.analytics_session_id) AS converting_sessions,
          COALESCE(SUM(CASE WHEN p.payment_type='refund' THEN -p.amount_minor ELSE p.amount_minor END),0) AS revenue_minor
        FROM analytics_attribution aa
        LEFT JOIN payments p ON p.id=aa.payment_id AND p.business_id=aa.business_id AND p.status IN ('paid','partially_refunded','refunded')
        WHERE aa.business_id=? AND datetime(aa.attributed_at)>=datetime(?)
        GROUP BY COALESCE(aa.source,'direct') ORDER BY bookings DESC, source ASC
      `).bind(businessId, since).all(),
      env.DB.prepare(`
        SELECT COALESCE(aa.source,'direct') AS source, COALESCE(aa.campaign,'(none)') AS campaign,
          COUNT(*) AS bookings,
          COALESCE(SUM(CASE WHEN p.payment_type='refund' THEN -p.amount_minor ELSE p.amount_minor END),0) AS revenue_minor
        FROM analytics_attribution aa
        LEFT JOIN payments p ON p.id=aa.payment_id AND p.business_id=aa.business_id AND p.status IN ('paid','partially_refunded','refunded')
        WHERE aa.business_id=? AND datetime(aa.attributed_at)>=datetime(?) AND aa.campaign IS NOT NULL
        GROUP BY aa.source, aa.campaign ORDER BY bookings DESC, campaign ASC LIMIT 50
      `).bind(businessId, since).all(),
      env.DB.prepare(`
        SELECT s.id AS service_id, s.name,
          COUNT(aa.id) AS bookings,
          COALESCE(SUM(CASE WHEN p.payment_type='refund' THEN -p.amount_minor ELSE p.amount_minor END),0) AS revenue_minor
        FROM analytics_attribution aa
        JOIN appointments a ON a.id=aa.appointment_id AND a.business_id=aa.business_id
        JOIN services s ON s.id=a.service_id AND s.business_id=a.business_id
        LEFT JOIN payments p ON p.id=aa.payment_id AND p.business_id=aa.business_id AND p.status IN ('paid','partially_refunded','refunded')
        WHERE aa.business_id=? AND datetime(aa.attributed_at)>=datetime(?)
        GROUP BY s.id, s.name ORDER BY bookings DESC, s.name ASC LIMIT 50
      `).bind(businessId, since).all()
    ]);

    const sourceVisits = await env.DB.prepare(`
      SELECT COALESCE(first_source,'direct') AS source, COUNT(*) AS visits
      FROM analytics_sessions WHERE business_id=? AND datetime(first_seen_at)>=datetime(?)
      GROUP BY COALESCE(first_source,'direct')
    `).bind(businessId, since).all();
    const visitsBySource = Object.fromEntries((sourceVisits.results || []).map(r => [r.source, Number(r.visits || 0)]));
    const sourceRows = (sources.results || []).map(r => ({ ...r, visits: visitsBySource[r.source] || 0 }));
    for (const [source, count] of Object.entries(visitsBySource)) {
      if (!sourceRows.some(r => r.source === source)) sourceRows.push({ source, visits: count, bookings: 0, converting_sessions: 0, revenue_minor: 0 });
    }
    sourceRows.sort((a,b) => Number(b.bookings)-Number(a.bookings) || Number(b.visits)-Number(a.visits));

    return Response.json({
      ok: true, range, since,
      business: { currency: user.currency || "GBP", locale: user.locale || "en-GB", timezone: user.timezone || "Europe/London" },
      totals: {
        visits: Number(visits?.count || 0), selected: Number(selected?.count || 0), started: Number(started?.count || 0),
        bookings: Number(bookings?.count || 0), revenue_minor: Number(revenue?.amount_minor || 0)
      },
      sources: sourceRows,
      campaigns: campaigns.results || [],
      services: services.results || []
    });
  } catch (error) {
    console.error("Analytics report failed:", error);
    return Response.json({ ok: false, error: "Unable to load analytics." }, { status: 500 });
  }
}
