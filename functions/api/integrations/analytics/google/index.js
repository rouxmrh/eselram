import { readSessionToken, hashSessionToken } from "../../../../../lib/auth.js";

async function getUserContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  return await env.DB.prepare(`
    SELECT u.id AS user_id, u.business_id
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now') AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();
}

function unauthorized() { return Response.json({ok:false,error:"Authentication required."},{status:401}); }
function validMeasurementId(value) { return /^G-[A-Z0-9]{6,20}$/i.test(String(value||"").trim()); }

async function getIntegration(env, businessId) {
  return env.DB.prepare(`
    SELECT provider, config_json, status, updated_at
    FROM business_integrations
    WHERE business_id = ? AND integration_type = 'analytics'
    LIMIT 1
  `).bind(businessId).first();
}

export async function onRequestGet({request, env}) {
  const user = await getUserContext(request, env); if (!user) return unauthorized();
  const row = await getIntegration(env, user.business_id);
  let config={}; try { config=JSON.parse(row?.config_json||"{}"); } catch {}
  return Response.json({ok:true,integration:{provider:row?.provider||"google_analytics",status:row?.status||"not_configured",measurement_id:config.measurement_id||"",updated_at:row?.updated_at||null}});
}

export async function onRequestPost({request, env}) {
  const user = await getUserContext(request, env); if (!user) return unauthorized();
  let body={}; try { body=await request.json(); } catch { return Response.json({ok:false,error:"Invalid request."},{status:400}); }
  const action=String(body.action||"save");
  if (action === "disconnect") {
    await env.DB.prepare(`DELETE FROM business_integrations WHERE business_id=? AND integration_type='analytics'`).bind(user.business_id).run();
    return Response.json({ok:true,status:"not_configured"});
  }
  const measurementId=String(body.measurement_id||"").trim().toUpperCase();
  if (!validMeasurementId(measurementId)) return Response.json({ok:false,error:"Enter a valid GA4 Measurement ID beginning G-."},{status:400});
  const id=`int_ga_${crypto.randomUUID()}`;
  const config=JSON.stringify({measurement_id:measurementId});
  await env.DB.prepare(`
    INSERT INTO business_integrations (id,business_id,integration_type,provider,config_json,status,created_at,updated_at)
    VALUES (?,?,'analytics','google_analytics',?,'configured',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(business_id,integration_type) DO UPDATE SET provider='google_analytics',config_json=excluded.config_json,status='configured',last_error=NULL,updated_at=CURRENT_TIMESTAMP
  `).bind(id,user.business_id,config).run();
  return Response.json({ok:true,status:"configured",measurement_id:measurementId});
}
