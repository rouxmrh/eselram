import { requireOwner } from "../../../lib/update-auth.js";
import { restoreProtectedR2Object } from "../../../lib/r2-protection.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireOwner(request, env); if (auth.response) return auth.response;
  try {
    const rows = await env.DB.prepare(`SELECT id,original_key,source_type,source_id,original_name,mime_type,size_bytes,reason,status,protected_until,created_at,restored_at FROM eselram_file_recovery_objects WHERE business_id=? ORDER BY datetime(created_at) DESC LIMIT 50`).bind(auth.session.business_id).all();
    return Response.json({ok:true,items:rows.results||[]},{headers:{"Cache-Control":"no-store"}});
  } catch (error) { return Response.json({ok:false,error:error?.message||"Unable to load file recovery."},{status:500}); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireOwner(request, env); if (auth.response) return auth.response;
  try {
    const body=await request.json();
    if(String(body?.confirmation||"").trim().toUpperCase()!=="RESTORE") return Response.json({ok:false,error:"Type RESTORE to confirm."},{status:400});
    const recoveryId=String(body?.recovery_id||"").trim(); if(!recoveryId) return Response.json({ok:false,error:"Recovery id is required."},{status:400});
    const row=await restoreProtectedR2Object({env,businessId:auth.session.business_id,recoveryId});
    return Response.json({ok:true,restored_key:row.original_key});
  } catch(error){ return Response.json({ok:false,error:error?.message||"Unable to restore protected file."},{status:500}); }
}
