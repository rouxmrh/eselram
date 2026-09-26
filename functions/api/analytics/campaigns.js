import { readSessionToken, hashSessionToken } from "../../../lib/auth.js";

async function context(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  return env.DB.prepare(`
    SELECT u.business_id
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();
}

const clean = (value, max) => String(value || "").trim().slice(0, max);
const validSource = value => ["instagram","facebook","google","website","tiktok","whatsapp","email","sms","google_ads","other"].includes(value);

export async function onRequestGet({ request, env }) {
  try {
    const user = await context(request, env);
    if (!user) return Response.json({ ok:false, error:"Authentication required." }, { status:401 });
    const rows = await env.DB.prepare(`
      SELECT id, source, medium, campaign, created_at
      FROM analytics_campaign_links
      WHERE business_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 100
    `).bind(user.business_id).all();
    return Response.json({ ok:true, campaigns:rows.results || [] });
  } catch (error) {
    console.error("Analytics campaigns load failed:", error);
    return Response.json({ ok:false, error:"Unable to load campaign links." }, { status:500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await context(request, env);
    if (!user) return Response.json({ ok:false, error:"Authentication required." }, { status:401 });
    let body={}; try { body=await request.json(); } catch { return Response.json({ok:false,error:"Invalid request."},{status:400}); }
    const source=clean(body.source,80).toLowerCase();
    const medium=clean(body.medium,80).toLowerCase();
    const campaign=clean(body.campaign,120).toLowerCase();
    if(!validSource(source) || !campaign) return Response.json({ok:false,error:"Choose a valid source and campaign name."},{status:400});
    const id=`acl_${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO analytics_campaign_links (id,business_id,source,medium,campaign,created_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(business_id,source,campaign)
      DO UPDATE SET medium=excluded.medium
    `).bind(id,user.business_id,source,medium || null,campaign).run();
    const row=await env.DB.prepare(`
      SELECT id,source,medium,campaign,created_at
      FROM analytics_campaign_links
      WHERE business_id=? AND source=? AND campaign=?
      LIMIT 1
    `).bind(user.business_id,source,campaign).first();
    return Response.json({ok:true,campaign:row});
  } catch(error) {
    console.error("Analytics campaign save failed:",error);
    return Response.json({ok:false,error:"Unable to save campaign link."},{status:500});
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await context(request, env);
    if (!user) return Response.json({ ok:false, error:"Authentication required." }, { status:401 });
    const id=clean(new URL(request.url).searchParams.get("id"),120);
    if(!id) return Response.json({ok:false,error:"Campaign link ID is required."},{status:400});
    await env.DB.prepare(`DELETE FROM analytics_campaign_links WHERE id=? AND business_id=?`).bind(id,user.business_id).run();
    return Response.json({ok:true});
  } catch(error) {
    console.error("Analytics campaign delete failed:",error);
    return Response.json({ok:false,error:"Unable to delete campaign link."},{status:500});
  }
}
