const RECOVERY_PREFIX = "_eselram-recovery/";
const RETENTION_DAYS = 30;

function safeSegment(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "unknown";
}

export async function preserveR2ObjectBeforeDelete({
  env, businessId, originalKey, sourceType, sourceId = null, originalName = null,
  mimeType = null, sizeBytes = null, reason = "delete", sourceMetadata = null
}) {
  if (!env?.FORM_UPLOADS || !env?.DB || !originalKey) throw new Error("R2 file protection is not configured.");
  const object = await env.FORM_UPLOADS.get(originalKey);
  if (!object) return { ok: true, missing: true };

  const id = `r2rec_${crypto.randomUUID()}`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const recoveryKey = `${RECOVERY_PREFIX}${safeSegment(businessId)}/${stamp}-${crypto.randomUUID()}/${originalKey}`;
  const protectedUntil = new Date(Date.now() + RETENTION_DAYS * 86400000).toISOString();
  const contentType = mimeType || object.httpMetadata?.contentType || "application/octet-stream";
  const bytes = Number(sizeBytes || object.size || 0) || null;
  const metadataJson = sourceMetadata ? JSON.stringify(sourceMetadata) : null;

  await env.FORM_UPLOADS.put(recoveryKey, object.body, {
    httpMetadata: { ...(object.httpMetadata || {}), contentType },
    customMetadata: {
      eselramRecovery: "1", originalKey: String(originalKey), sourceType: String(sourceType || "file"),
      sourceId: String(sourceId || ""), protectedUntil
    }
  });

  try {
    await env.DB.prepare(`
      INSERT INTO eselram_file_recovery_objects (
        id,business_id,original_key,recovery_key,source_type,source_id,original_name,mime_type,size_bytes,reason,status,protected_until,source_metadata_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,'available',?,?)
    `).bind(id,businessId,originalKey,recoveryKey,sourceType || 'file',sourceId,originalName,contentType,bytes,reason,protectedUntil,metadataJson).run();
  } catch (error) {
    // Do not delete the recovery object here: the bucket lock may already protect it, and preserving data is safer.
    throw error;
  }
  return { ok: true, id, recoveryKey, protectedUntil };
}

export async function getProtectedR2Recovery({ env, businessId, recoveryId }) {
  const row = await env.DB.prepare(`
    SELECT * FROM eselram_file_recovery_objects WHERE id=? AND business_id=? AND status='available' LIMIT 1
  `).bind(recoveryId,businessId).first();
  if (!row) throw new Error("Protected file recovery copy was not found.");
  return row;
}

export async function restoreProtectedR2Object({ env, row }) {
  if (!row?.recovery_key || !row?.original_key) throw new Error("Protected file recovery details are incomplete.");
  const object = await env.FORM_UPLOADS.get(row.recovery_key);
  if (!object) throw new Error("Protected R2 recovery object is missing.");
  await env.FORM_UPLOADS.put(row.original_key, object.body, {
    httpMetadata: object.httpMetadata || undefined
  });
  return row;
}

export async function markProtectedR2RecoveryRestored({ env, businessId, recoveryId }) {
  await env.DB.prepare(`
    UPDATE eselram_file_recovery_objects
    SET status='restored', restored_at=CURRENT_TIMESTAMP
    WHERE id=? AND business_id=? AND status='available'
  `).bind(recoveryId,businessId).run();
}
