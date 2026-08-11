import {
  issueManageToken
} from "../../../lib/self-service.js";

import {
  getPublicBusiness,
  cleanupPendingOnlineBookings,
  badRequest,
  serverError
} from "../../../lib/public-booking.js";

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
          `/manage-booking/?token=${encodeURIComponent(manageToken)}`;
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
        start_at: row.start_at,
        end_at: row.end_at,
        price_minor: Number(row.price_minor || 0),
        deposit_due_minor: Number(row.deposit_due_minor || 0),
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
