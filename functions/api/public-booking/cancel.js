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
          a.customer_id,
          CASE
            WHEN ABS((julianday(a.created_at) - julianday(c.created_at)) * 86400) <= 120
            THEN 1 ELSE 0
          END AS customer_created_for_checkout,
          a.status AS appointment_status,
          p.id AS payment_id,
          p.status AS payment_status,
          p.provider_reference
        FROM appointments a
        JOIN customers c
          ON c.id = a.customer_id
         AND c.business_id = a.business_id
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

    // Check Stripe itself before cancelling. This protects a customer whose
    // card payment completed but whose webhook has not reached Eselram yet.
    if (
      row.provider_reference &&
      row.payment_status === "pending"
    ) {
      try {
        const integration =
          await getBusinessStripeIntegration(
            env,
            business.id
          );

        if (!integration.error) {
          const currentSession =
            await stripeRequest({
              secretKey:
                integration.secretKey,
              path:
                `/v1/checkout/sessions/${encodeURIComponent(
                  row.provider_reference
                )}`
            });

          if (
            currentSession.response.ok &&
            currentSession.data?.payment_status ===
              "paid"
          ) {
            await env.DB
              .prepare(`
                UPDATE payments
                SET
                  status = 'paid',
                  paid_at = COALESCE(
                    paid_at,
                    CURRENT_TIMESTAMP
                  ),
                  notes =
                    'Public booking Stripe Checkout payment confirmed while returning from Checkout',
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE
                  id = ?
                  AND business_id = ?
                  AND status = 'pending'
              `)
              .bind(
                paymentId,
                business.id
              )
              .run();

            await env.DB
              .prepare(`
                UPDATE appointments
                SET
                  status = 'confirmed',
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE
                  id = ?
                  AND business_id = ?
                  AND status = 'pending'
              `)
              .bind(
                appointmentId,
                business.id
              )
              .run();

            return Response.json({
              ok: true,
              paid: true,
              cancelled: false
            });
          }

          if (
            currentSession.response.ok &&
            currentSession.data?.status ===
              "open"
          ) {
            await stripeRequest({
              secretKey:
                integration.secretKey,
              path:
                `/v1/checkout/sessions/${encodeURIComponent(
                  row.provider_reference
                )}/expire`,
              method: "POST"
            });
          }
        }
      } catch (error) {
        // Local cancellation is still safe for an unpaid pending record.
        // Stripe's own Checkout expiry remains a second safety net.
        console.error(
          "Unable to verify/expire returned public Checkout session:",
          error
        );
      }
    }

    // This is an unpaid provisional public booking, not a genuine booking or
    // transaction. Remove both records immediately when the customer returns
    // from Stripe without paying. If they simply close the Stripe tab instead,
    // cleanupPendingOnlineBookings removes the same records after expiry.
    await env.DB
      .prepare(`
        DELETE FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND appointment_id = ?
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `)
      .bind(paymentId, business.id, appointmentId)
      .run();

    await env.DB
      .prepare(`
        DELETE FROM appointments
        WHERE
          id = ?
          AND business_id = ?
          AND booking_source = 'online'
          AND status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM payments p
            WHERE
              p.appointment_id = appointments.id
              AND p.business_id = appointments.business_id
              AND p.status IN ('paid', 'partially_refunded', 'refunded')
              AND p.payment_type != 'refund'
          )
      `)
      .bind(appointmentId, business.id)
      .run();

    // Remove the customer only when this checkout appears to have created the
    // customer record itself. Never remove an established/manual customer just
    // because they abandoned a later online checkout.
    const customerWasCreatedForCheckout =
      Number(row.customer_created_for_checkout || 0) === 1;

    if (customerWasCreatedForCheckout && row.customer_id) {
      await env.DB
        .prepare(`
          DELETE FROM customers
          WHERE
            id = ?
            AND business_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM appointments a WHERE a.customer_id = customers.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM payments p WHERE p.customer_id = customers.id
            )
        `)
        .bind(row.customer_id, business.id)
        .run();
    }

    return Response.json({ ok: true, paid: false, cancelled: true });
  } catch (error) {
    console.error("Public booking cancellation failed:", error);
    return serverError("Unable to release the booking slot.");
  }
}
