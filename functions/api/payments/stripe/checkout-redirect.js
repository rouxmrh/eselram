import {
  getBusinessStripeIntegration,
  stripeRequest
} from "../../../../lib/stripe-business.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const paymentId = String(
      url.searchParams.get("payment_id") || ""
    ).trim();

    if (!paymentId.startsWith("pay_")) {
      return new Response("Invalid payment link.", { status: 400 });
    }

    const payment = await env.DB
      .prepare(`
        SELECT
          id, business_id, provider_reference, status
        FROM payments
        WHERE id = ?
          AND provider = 'stripe'
          AND provider_reference IS NOT NULL
          AND provider_reference != ''
        LIMIT 1
      `)
      .bind(paymentId)
      .first();

    if (!payment) {
      return new Response("Payment link not found.", { status: 404 });
    }

    const integration = await getBusinessStripeIntegration(
      env,
      payment.business_id
    );

    if (integration.error) {
      return new Response("Payment link is temporarily unavailable.", { status: 503 });
    }

    const stripeResult = await stripeRequest({
      secretKey: integration.secretKey,
      path: `/v1/checkout/sessions/${encodeURIComponent(payment.provider_reference)}`
    });

    if (!stripeResult.response.ok || !stripeResult.data?.url) {
      return new Response("Payment link has expired or is unavailable.", { status: 410 });
    }

    return Response.redirect(stripeResult.data.url, 302);
  } catch (error) {
    console.error("Stripe QR redirect failed:", error);
    return new Response("Payment link is temporarily unavailable.", { status: 500 });
  }
}
