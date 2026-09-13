import { requireOwner, installedBillingAssertion, brokerJson, subscriptionBrokerBase } from "../../../lib/update-auth.js";

function isPermanentQaHost(request) {
  try {
    return new URL(request.url).hostname.toLowerCase() === "eselram-qa-admin.eselram.com";
  } catch {
    return false;
  }
}

function complimentaryQaPayload() {
  return {
    ok: true,
    subscription: {
      plan: "complimentary_tester",
      billing_interval: "complimentary",
      status: "active",
      license_status: "active",
      current_period_end: null,
      cancel_at_period_end: false,
      grace_until: null,
      currency: "gbp",
      unit_amount: 0,
      is_complimentary: true
    },
    invoices: []
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;
    const assertion = await installedBillingAssertion(env, "status");
    const result = await brokerJson(env, "/api/installed-billing/status", assertion, subscriptionBrokerBase(request, env));
    return Response.json({ ok: true, subscription: result.subscription || null, invoices: result.invoices || [] }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    // The permanent Eselram QA installation intentionally uses a complimentary
    // tester licence. It predates the installed-billing broker endpoints and has
    // no Stripe subscription to manage. Keep that QA-only case explicit so a
    // missing broker route can never be mistaken for a paid production licence.
    if (isPermanentQaHost(request) && [404, 405].includes(Number(error?.status))) {
      return Response.json(complimentaryQaPayload(), {
        headers: { "Cache-Control": "no-store" }
      });
    }
    return Response.json({ ok: false, error: error?.message || "Unable to load Eselram subscription details." }, {
      status: Number(error?.status) || 500, headers: { "Cache-Control": "no-store" }
    });
  }
}
