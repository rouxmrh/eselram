import {
  requireOwner,
  installedBillingAssertion,
  installedUpdateAssertion,
  brokerJson,
  subscriptionBrokerBase,
  updateBrokerBase
} from "../../../lib/update-auth.js";

function complimentaryPayload(license = {}) {
  const licenseStatus = String(license?.status || "active").trim().toLowerCase() || "active";
  return {
    ok: true,
    subscription: {
      plan: "complimentary_tester",
      billing_interval: "complimentary",
      status: licenseStatus,
      license_status: licenseStatus,
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

function isComplimentaryTester(license = {}) {
  const plan = String(license?.plan || "").trim().toLowerCase();
  const source = String(license?.purchase_source || "").trim().toLowerCase();
  return plan === "tester" || source === "complimentary_tester";
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireOwner(request, env);
    if (auth.response) return auth.response;

    // First use the long-established secure update-status route. This route is
    // available to existing installations and tells us whether the installation
    // is on a complimentary tester licence without touching Stripe billing.
    const updateAssertion = await installedUpdateAssertion(env);
    const entitlement = await brokerJson(
      env,
      "/api/installed-update/status",
      updateAssertion,
      updateBrokerBase(env)
    );

    if (isComplimentaryTester(entitlement?.license)) {
      return Response.json(complimentaryPayload(entitlement.license), {
        headers: { "Cache-Control": "no-store" }
      });
    }

    // Paid installations continue through the dedicated billing route.
    const assertion = await installedBillingAssertion(env, "status");
    const result = await brokerJson(
      env,
      "/api/installed-billing/status",
      assertion,
      subscriptionBrokerBase(request, env)
    );
    return Response.json({ ok: true, subscription: result.subscription || null, invoices: result.invoices || [] }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unable to load Eselram subscription details." }, {
      status: Number(error?.status) || 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
