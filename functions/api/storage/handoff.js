import { requireOwner, installedUpdateAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    if (env.FORM_UPLOADS) {
      return Response.json({ ok: true, already_configured: true, setup_url: null }, { headers: { "Cache-Control": "no-store" } });
    }
    const assertion = await installedUpdateAssertion(env);
    const result = await brokerJson(env, "/api/installed-storage/handoff", assertion);
    return Response.json({
      ok: true,
      already_configured: false,
      current_version: result.current_version || assertion.current_version,
      setup_url: result.setup_url || null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to start secure file storage setup." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
