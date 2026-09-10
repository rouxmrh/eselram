import { requireOwner, installedUpdateAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const assertion = await installedUpdateAssertion(env);
    const result = await brokerJson(env, "/api/installed-update/status", assertion);
    let recovery = null;
    let recoveryPoints = [];
    try {
      const rows = await env.DB.prepare(`
        SELECT id, recovery_type, bookmark, from_version, target_version, status, created_at
        FROM eselram_recovery_points
        WHERE status = 'available'
        ORDER BY datetime(created_at) DESC
        LIMIT 5
      `).all();
      recoveryPoints = Array.isArray(rows?.results) ? rows.results : [];
      recovery = recoveryPoints[0] || null;
    } catch {}
    return Response.json({
      ok: true,
      installed_version: result.installation?.installed_version || assertion.current_version,
      available_version: result.release?.version || assertion.current_version,
      update_available: result.update_available === true,
      release_type: result.release?.release_type || null,
      release_notes: result.release?.release_notes || null,
      published_at: result.release?.published_at || null,
      updates_until: result.license?.updates_until || null,
      recovery_protection: {
        time_travel: true,
        latest: recovery || null,
        latest_pre_update: recoveryPoints.find((point) => point?.recovery_type === "pre_update") || null,
        latest_restore_undo: recoveryPoints.find((point) => point?.recovery_type === "restore_undo") || null,
        points: recoveryPoints,
        rollback_available: Boolean(
          recovery?.recovery_type === "pre_update" &&
          recovery?.id &&
          recovery?.bookmark &&
          recovery?.from_version &&
          recovery?.target_version &&
          String(recovery.target_version) === String(result.installation?.installed_version || assertion.current_version)
        )
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to check for Eselram updates." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
