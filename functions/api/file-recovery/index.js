import { requireOwner } from "../../../lib/update-auth.js";
import { getProtectedR2Recovery, restoreProtectedR2Object, markProtectedR2RecoveryRestored } from "../../../lib/r2-protection.js";

function parseMetadata(row) {
  try { return row?.source_metadata_json ? JSON.parse(row.source_metadata_json) : null; }
  catch { return null; }
}

async function optionalExistingId(env, table, businessId, id) {
  if (!id) return null;
  const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND business_id=? LIMIT 1`).bind(id,businessId).first();
  return row?.id || null;
}

async function validateCustomerPhotoRestore({ env, businessId, row, metadata }) {
  if (!metadata?.customer_id) throw new Error("This older recovery copy does not contain the customer-photo metadata required for a complete restore. Create a new protected copy after updating Eselram and try again.");
  const customer = await env.DB.prepare(`SELECT id FROM customers WHERE id=? AND business_id=? LIMIT 1`).bind(metadata.customer_id,businessId).first();
  if (!customer) throw new Error("The customer record no longer exists. Recover the database to the matching point before restoring this file.");
  const existing = await env.DB.prepare(`SELECT id FROM customer_photos WHERE id=? AND business_id=? LIMIT 1`).bind(metadata.id || row.source_id,businessId).first();
  return { existing: !!existing };
}

async function restoreCustomerPhotoRecord({ env, businessId, row, metadata }) {
  const id = metadata.id || row.source_id;
  const appointmentId = await optionalExistingId(env,"appointments",businessId,metadata.appointment_id);
  const serviceId = await optionalExistingId(env,"services",businessId,metadata.service_id);
  const treatmentRecordId = await optionalExistingId(env,"treatment_records",businessId,metadata.treatment_record_id);
  const uploadedByUserId = metadata.uploaded_by_user_id
    ? (await env.DB.prepare(`SELECT id FROM users WHERE id=? AND business_id=? LIMIT 1`).bind(metadata.uploaded_by_user_id,businessId).first())?.id || null
    : null;
  await env.DB.prepare(`
    INSERT OR IGNORE INTO customer_photos (
      id,business_id,customer_id,appointment_id,service_id,treatment_record_id,photo_type,storage_provider,storage_key,original_name,mime_type,size_bytes,taken_at,notes,uploaded_by_user_id,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,businessId,metadata.customer_id,appointmentId,serviceId,treatmentRecordId,metadata.photo_type || 'other',
    metadata.storage_provider || 'r2',row.original_key,metadata.original_name || row.original_name || null,
    metadata.mime_type || row.mime_type || 'application/octet-stream',Number(metadata.size_bytes || row.size_bytes || 0),
    metadata.taken_at || null,metadata.notes || null,uploadedByUserId,metadata.created_at || new Date().toISOString(),metadata.updated_at || new Date().toISOString()
  ).run();
}

async function validateClinicalUploadRestore({ env, businessId, row, metadata }) {
  if (!metadata?.submission_id) throw new Error("This older recovery copy does not contain the clinical-upload metadata required for a complete restore.");
  const submission = await env.DB.prepare(`SELECT id FROM clinical_form_submissions WHERE id=? AND business_id=? LIMIT 1`).bind(metadata.submission_id,businessId).first();
  if (!submission) throw new Error("The clinical record linked to this upload no longer exists. Recover the database to the matching point first, then restore the file if required.");
  const existing = await env.DB.prepare(`SELECT id FROM clinical_form_uploads WHERE id=? AND business_id=? LIMIT 1`).bind(metadata.id || row.source_id,businessId).first();
  return { existing: !!existing };
}

async function restoreClinicalUploadRecord({ env, businessId, row, metadata }) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO clinical_form_uploads (id,submission_id,business_id,field_key,storage_provider,storage_key,original_name,mime_type,size_bytes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    metadata.id || row.source_id,metadata.submission_id,businessId,metadata.field_key,metadata.storage_provider || 'r2',row.original_key,
    metadata.original_name || row.original_name || 'Recovered file',metadata.mime_type || row.mime_type || null,
    Number(metadata.size_bytes || row.size_bytes || 0),metadata.created_at || new Date().toISOString()
  ).run();
}

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
    const businessId=auth.session.business_id;
    const row=await getProtectedR2Recovery({env,businessId,recoveryId});
    const metadata=parseMetadata(row);

    if(row.source_type==='customer_photo') await validateCustomerPhotoRestore({env,businessId,row,metadata});
    if(row.source_type==='clinical_form_upload') await validateClinicalUploadRestore({env,businessId,row,metadata});

    await restoreProtectedR2Object({env,row});

    if(row.source_type==='customer_photo') await restoreCustomerPhotoRecord({env,businessId,row,metadata});
    if(row.source_type==='clinical_form_upload') await restoreClinicalUploadRecord({env,businessId,row,metadata});

    await markProtectedR2RecoveryRestored({env,businessId,recoveryId});
    return Response.json({ok:true,restored_key:row.original_key});
  } catch(error){ return Response.json({ok:false,error:error?.message||"Unable to restore protected file."},{status:500}); }
}
