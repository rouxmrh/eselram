import { requireOwner, installedBillingAssertion, brokerJson } from "../../../lib/update-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const url = new URL(request.url);
    const returnUrl = `${url.origin}/settings/subscription.html?payment_method=updated`;
    const assertion = await installedBillingAssertion(env, "payment-method", returnUrl);
    const result = await brokerJson(env, "/api/installed-billing/payment-method", assertion);
    if (!result.url) throw Object.assign(new Error("Stripe did not return a secure payment-method update link."), { status: 502 });
    return Response.json({ ok: true, url: result.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to start the secure payment-method update." }, {
      status: Number(error?.status) || 500, headers: { "Cache-Control": "no-store" }
    });
  }
}
