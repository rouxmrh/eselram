import {
  issueManageToken
} from "../../../lib/self-service.js";

import {
  getPublicBusiness,
  cleanupPendingOnlineBookings,
  badRequest,
  serverError
} from "../../../lib/public-booking.js";

import {
  getBusinessStripeIntegration,
  stripeRequest
} from "../../../lib/stripe-business.js";

import {
  sendAppointmentCommunication,
  sendPaymentReceipt
} from "../../../lib/communications.js";

import {
  runServiceFormAutomation
} from "../../../lib/form-automation.js";

export async function onRequestGet({ request, env }) {
  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json(
        { ok: false, error: "This booking page is not configured." },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const appointmentId = String(url.searchParams.get("appointment_id") || "").trim();
    const sessionId = String(url.searchParams.get("session_id") || "").trim();

    if (!appointmentId || !sessionId) {
      return badRequest("Booking reference and payment session are required.");
    }

    await cleanupPendingOnlineBookings(env, business.id);

    const row = await env.DB
      .prepare(`
        SELECT
          a.id,
          a.customer_id,
          a.status,
          a.start_at,
          a.end_at,
          a.price_minor,
          a.deposit_due_minor,
          a.consultation_credit_minor,
          a.booking_kind,
          s.name AS service_name,
          s.requires_consultation,
          s.requires_patch_test,
          p.id AS payment_id,
          p.status AS payment_status,
          p.amount_minor AS payment_amount_minor,
          p.payment_type,
          p.currency
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN payments p ON p.appointment_id = a.id
        WHERE
          a.id = ?
          AND a.business_id = ?
          AND p.provider = 'stripe'
          AND p.provider_reference = ?
        ORDER BY datetime(p.created_at) DESC
        LIMIT 1
      `)
      .bind(appointmentId, business.id, sessionId)
      .first();

    if (!row) {
      return Response.json(
        { ok: false, error: "Booking confirmation could not be found." },
        { status: 404 }
      );
    }

    const baseUrl = new URL(request.url).origin;

    // The Stripe webhook is the primary asynchronous confirmation path, but a
    // customer returning from Checkout must not depend on a webhook being
    // configured. Verify the Checkout Session directly as a safe fallback.
    if (
      !["paid", "partially_refunded", "refunded"].includes(
        String(row.payment_status || "")
      )
    ) {
      const integration =
        await getBusinessStripeIntegration(
          env,
          business.id
        );

      if (!integration.error) {
        const stripeResult =
          await stripeRequest({
            secretKey: integration.secretKey,
            path: `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`
          });

        if (
          stripeResult.response.ok &&
          stripeResult.data?.payment_status === "paid"
        ) {
          await env.DB
            .prepare(`
              UPDATE payments
              SET
                status = 'paid',
                payment_method = ?,
                paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                notes = 'Stripe Checkout payment confirmed on booking return',
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND business_id = ?
            `)
            .bind(
              String(
                stripeResult.data?.payment_method_types?.[0] ||
                "card"
              ),
              row.payment_id,
              business.id
            )
            .run();

          row.payment_status = "paid";
        }
      }
    }

    if (
      ["paid", "partially_refunded", "refunded"].includes(
        String(row.payment_status || "")
      ) &&
      row.status === "pending"
    ) {
      await env.DB
        .prepare(`
          UPDATE appointments
          SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ? AND status = 'pending'
        `)
        .bind(appointmentId, business.id)
        .run();
      row.status = "confirmed";
    }

    const paymentConfirmed =
      ["paid", "partially_refunded", "refunded"].includes(
        String(row.payment_status || "")
      );

    if (paymentConfirmed && row.status === "confirmed") {
      // All communication helpers are idempotent through their unique keys, so
      // this safely covers both webhook-first and browser-return-first flows.
      try {
        await sendPaymentReceipt({
          env,
          businessId: business.id,
          paymentId: row.payment_id,
          baseUrl
        });
      } catch (error) {
        console.error("Booking return payment receipt failed:", error);
      }

      try {
        await sendAppointmentCommunication({
          env,
          businessId: business.id,
          appointmentId,
          type: "booking_confirmation",
          uniqueKey: `booking_confirmation:${appointmentId}`,
          baseUrl
        });
      } catch (error) {
        console.error("Booking return confirmation email failed:", error);
      }

      try {
        await runServiceFormAutomation({
          env,
          businessId: business.id,
          appointmentId,
          triggerEvent: "booking_confirmed",
          baseUrl
        });
      } catch (error) {
        console.error("Booking return form automation failed:", error);
      }

      try {
        await runServiceFormAutomation({
          env,
          businessId: business.id,
          appointmentId,
          triggerEvent: "payment_received",
          baseUrl
        });
      } catch (error) {
        console.error("Payment return form automation failed:", error);
      }
    }

    const confirmed =
      row.status === "confirmed" &&
      ["paid", "partially_refunded", "refunded"].includes(
        String(row.payment_status || "")
      );

    let manageUrl = null;

    if (confirmed) {
      try {
        const manageToken =
          await issueManageToken({
            env,
            businessId:
              business.id,
            appointmentId:
              row.id,
            customerId:
              row.customer_id
          });

        manageUrl =
          `/manage-booking/#token=${encodeURIComponent(manageToken)}`;
      } catch (error) {
        console.error(
          "Unable to issue success-page manage link:",
          error
        );
      }
    }

    return Response.json({
      ok: true,
      booking: {
        id: row.id,
        status: row.status,
        service_name: row.service_name,
        booking_kind:
          row.booking_kind ||
          "service",
        booking_label:
          row.booking_kind ===
            "consultation"
            ? `Consultation · ${row.service_name}`
            : row.service_name,
        start_at: row.start_at,
        end_at: row.end_at,
        price_minor: Number(row.price_minor || 0),
        deposit_due_minor: Number(row.deposit_due_minor || 0),
        consultation_credit_minor: Number(
          row.consultation_credit_minor || 0
        ),
        requires_consultation: Number(row.requires_consultation || 0),
        requires_patch_test: Number(row.requires_patch_test || 0)
      },
      payment: {
        status: row.payment_status,
        amount_minor: Number(row.payment_amount_minor || 0),
        payment_type: row.payment_type,
        currency: row.currency
      },
      manage_url:
        manageUrl,

      confirmed
    });
  } catch (error) {
    console.error("Public booking status failed:", error);
    return serverError("Unable to confirm the booking yet.");
  }
}
