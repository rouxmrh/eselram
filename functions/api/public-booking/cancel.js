import {
  getPublicBusiness,
  badRequest,
  serverError
} from "../../../lib/public-booking.js";

import {
  getBusinessStripeIntegration,
  stripeRequest
} from "../../../lib/stripe-business.js";

export async function onRequestPost({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json(
        { ok: false, error: "This booking page is not configured." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const appointmentId = String(body.appointment_id || "").trim();
    const paymentId = String(body.payment_id || "").trim();

    if (!appointmentId || !paymentId) {
      return badRequest("Booking reference is required.");
    }

    const row = await env.DB
      .prepare(`
        SELECT
          a.id,
          a.status AS appointment_status,
          p.id AS payment_id,
          p.status AS payment_status,
          p.provider_reference
        FROM appointments a
        JOIN payments p ON p.appointment_id = a.id
        WHERE
          a.id = ?
          AND a.business_id = ?
          AND p.id = ?
          AND p.business_id = a.business_id
          AND p.provider = 'stripe'
        LIMIT 1
      `)
      .bind(appointmentId, business.id, paymentId)
      .first();

    if (!row) {
      return Response.json(
        { ok: false, error: "Booking could not be found." },
        { status: 404 }
      );
    }

    // Never cancel a booking if payment has already succeeded.
    if (["paid", "partially_refunded", "refunded"].includes(row.payment_status)) {
      if (row.appointment_status === "pending") {
        await env.DB
          .prepare(`
            UPDATE appointments
            SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND business_id = ? AND status = 'pending'
          `)
          .bind(appointmentId, business.id)
          .run();
      }

      return Response.json({ ok: true, paid: true, cancelled: false });
    }

    // Make the old hosted Checkout URL unusable before releasing the slot.
    if (row.provider_reference && row.payment_status === "pending") {
      try {
        const integration = await getBusinessStripeIntegration(env, business.id);
        if (!integration.error) {
          await stripeRequest({
            secretKey: integration.secretKey,
            path: `/v1/checkout/sessions/${encodeURIComponent(row.provider_reference)}/expire`,
            method: "POST"
          });
        }
      } catch (error) {
        // The appointment can still be cancelled locally. Stripe's expiry webhook
        // or the 30-minute expiry remains a second safety net.
        console.error("Unable to expire cancelled public Checkout session:", error);
      }
    }

    await env.DB
      .prepare(`
        UPDATE payments
        SET
          status = CASE WHEN status = 'pending' THEN 'failed' ELSE status END,
          notes = CASE
            WHEN status = 'pending' THEN 'Public booking Checkout cancelled by customer'
            ELSE notes
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `)
      .bind(paymentId, business.id)
      .run();

    await env.DB
      .prepare(`
        UPDATE appointments
        SET
          status = 'cancelled',
          cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP),
          cancellation_reason = COALESCE(
            cancellation_reason,
            'Customer left online payment before completion'
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ? AND status = 'pending'
      `)
      .bind(appointmentId, business.id)
      .run();

    return Response.json({ ok: true, paid: false, cancelled: true });
  } catch (error) {
    console.error("Public booking cancellation failed:", error);
    return serverError("Unable to release the booking slot.");
  }
}
