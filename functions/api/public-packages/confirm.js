import {
  confirmPublicPackagePayment
} from "../../../lib/public-package-payment.js";

function badRequest(message) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const saleId = String(body?.sale_id || "").trim();
    const sessionId = String(body?.session_id || "").trim();

    if (!saleId || !sessionId.startsWith("cs_")) {
      return badRequest("A valid package sale and Stripe Checkout Session are required.");
    }

    const result = await confirmPublicPackagePayment({
      env,
      saleId,
      sessionId,
      baseUrl: new URL(request.url).origin,
      sendReceipt: true
    });

    if (!result.ok) {
      return Response.json(result, { status: result.not_found ? 404 : 502 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Public package payment confirmation failed:", error);
    return Response.json({ ok: false, error: "Unable to confirm package payment." }, { status: 500 });
  }
}
