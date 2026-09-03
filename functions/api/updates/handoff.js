import { requireOwner, installedUpdateAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const assertion = await installedUpdateAssertion(env);
    const result = await brokerJson(env, "/api/installed-update/handoff", assertion);
    return Response.json({
      ok: true,
      update_available: result.update_available === true,
      current_version: result.current_version || assertion.current_version,
      target_version: result.target_version || assertion.current_version,
      updater_url: result.updater_url || null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to open the secure updater." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
