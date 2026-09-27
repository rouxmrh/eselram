import { requireOwner, installedBillingAssertion, brokerJson } from "../../../../../../lib/update-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/api/integrations/payments/stripe/connect/complete`;
    const assertion = await installedBillingAssertion(env, "stripe-connect", returnUrl);
    const result = await brokerJson(env, "/api/installed-stripe/handoff", assertion);
    return Response.json({ ok: true, connect_url: result.connect_url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to start Stripe connection." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
