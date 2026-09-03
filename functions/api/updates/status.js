import { requireOwner, installedUpdateAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const assertion = await installedUpdateAssertion(env);
    const result = await brokerJson(env, "/api/installed-update/status", assertion);
    return Response.json({
      ok: true,
      installed_version: result.installation?.installed_version || assertion.current_version,
      available_version: result.release?.version || assertion.current_version,
      update_available: result.update_available === true,
      release_type: result.release?.release_type || null,
      release_notes: result.release?.release_notes || null,
      published_at: result.release?.published_at || null,
      updates_until: result.license?.updates_until || null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to check for Eselram updates." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
