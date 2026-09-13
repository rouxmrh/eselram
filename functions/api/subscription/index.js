import { requireOwner, installedBillingAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const assertion = await installedBillingAssertion(env, "status");
    const result = await brokerJson(env, "/api/installed-billing/status", assertion);
    return Response.json({ ok: true, subscription: result.subscription || null, invoices: result.invoices || [] }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to load Eselram subscription details." }, {
      status: Number(error?.status) || 500, headers: { "Cache-Control": "no-store" }
    });
  }
}
