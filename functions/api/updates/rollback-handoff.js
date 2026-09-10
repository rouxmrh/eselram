import { requireOwner, installedUpdateAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const recoveryId = String(body.recovery_id || "").trim();
    const confirmation = String(body.confirmation || "").trim().toUpperCase();
    if (!recoveryId) {
      return Response.json({ ok: false, error: "Choose a valid recovery point." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (confirmation !== "ROLLBACK") {
      return Response.json({ ok: false, error: "Type ROLLBACK to confirm this recovery." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const assertion = await installedUpdateAssertion(env);
    const recovery = await env.DB.prepare(`
      SELECT id, recovery_type, bookmark, from_version, target_version, status, created_at
      FROM eselram_recovery_points
      WHERE id = ? AND recovery_type = 'pre_update' AND status = 'available'
      LIMIT 1
    `).bind(recoveryId).first();

    if (!recovery?.bookmark || !recovery?.from_version || !recovery?.target_version) {
      return Response.json({ ok: false, error: "That recovery point is no longer available." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    if (String(recovery.target_version) !== String(assertion.current_version)) {
      return Response.json({
        ok: false,
        error: `This recovery point belongs to Eselram ${recovery.target_version}. The installed version is ${assertion.current_version}, so rollback has been blocked.`
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const result = await brokerJson(env, "/api/installed-recovery/handoff", {
      ...assertion,
      recovery_id: recovery.id,
      recovery_bookmark: recovery.bookmark,
      from_version: recovery.from_version,
      target_version: recovery.target_version,
      created_at: recovery.created_at
    });

    return Response.json({
      ok: true,
      current_version: assertion.current_version,
      restore_version: recovery.from_version,
      updater_url: result.updater_url || null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to open secure database recovery." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
