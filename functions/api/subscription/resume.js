import { requireOwner, installedBillingAssertion, brokerJson, subscriptionBrokerBase } from "../../../lib/update-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const assertion = await installedBillingAssertion(env, "resume");
    const result = await brokerJson(env, "/api/installed-billing/resume", assertion, subscriptionBrokerBase(request, env));
    return Response.json({ ok: true, subscription: result.subscription || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to keep this subscription active." }, {
      status: Number(error?.status) || 500, headers: { "Cache-Control": "no-store" }
    });
  }
}
