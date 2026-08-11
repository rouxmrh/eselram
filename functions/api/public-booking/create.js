import {
  getPublicBusiness,
  getPublicService,
  getAvailableSlots,
  cleanupPendingOnlineBookings,
  findOrCreatePublicCustomer,
  deleteUnusedCustomer,
  addMinutesToDateTime,
  validDate,
  validTime,
  validEmail,
  badRequest,
  conflict,
  serverError
} from "../../../lib/public-booking.js";

import {
  runServiceFormAutomation
} from "../../../lib/form-automation.js";

import {
  sendAppointmentCommunication
} from "../../../lib/communications.js";

import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../lib/stripe-business.js";

function clean(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

export async function onRequestPost({ request, env }) {
  let createdCustomerId = null;
  let createdAppointmentId = null;
  let createdPaymentId = null;

  try {
    const business = await getPublicBusiness(env);
    if (!business) {
      return Response.json(
        { ok: false, error: "This booking page is not configured." },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Public Booking v1 does not silently accept anti-spam false positives.
    // If an older cached client still sends the former honeypot field, fail visibly
    // rather than ever showing a false booking confirmation.
    if (clean(body.company_website, 200)) {
      return badRequest("We couldn't complete the booking. Please refresh the page and try again.");
    }

    const serviceId = clean(body.service_id, 120);
    const date = clean(body.date, 10);
    const time = clean(body.time, 5);
    const firstName = clean(body.first_name, 100);
    const lastName = clean(body.last_name, 100);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 50);
    const notes = clean(body.notes, 1000);
    const marketingConsent = body.marketing_consent === true;

    if (!serviceId) return badRequest("Please choose a service.");
    if (!validDate(date)) return badRequest("Please choose a valid date.");
    if (!validTime(time)) return badRequest("Please choose a valid time.");
    if (!firstName) return badRequest("First name is required.");
    if (!lastName) return badRequest("Last name is required.");
    if (!email || !validEmail(email)) {
      return badRequest("A valid email address is required.");
    }

    await cleanupPendingOnlineBookings(env, business.id);

    const service = await getPublicService(env, business.id, serviceId);
    if (!service || service.is_active !== 1) {
      return badRequest("That service is no longer available.");
    }

    const availability = await getAvailableSlots({
      env,
      business,
      service,
      date
    });

    if (availability.error) {
      return badRequest(
        availability.error
      );
    }

    if (
      !(availability.slots || [])
        .includes(time)
    ) {
      return conflict(
        availability.reason ||
        "That time is no longer available. Please choose another time."
      );
    }

    const paymentTiming = String(service.payment_timing || "pay_at_appointment");
    const priceMinor = Math.max(0, Number(service.price_minor || 0));
    const depositMinor = Math.max(0, Number(service.deposit_minor || 0));
    const requiresOnlinePayment =
      paymentTiming === "online_deposit" || paymentTiming === "online_full";

    let stripeIntegration = null;

    if (requiresOnlinePayment) {
      const providerLink = await env.DB
        .prepare(`
          SELECT 1
          FROM service_payment_providers
          WHERE service_id = ? AND provider_key = 'stripe'
          LIMIT 1
        `)
        .bind(service.id)
        .first();

      if (!providerLink) {
        return badRequest("Online payment is not configured for this service.");
      }

      stripeIntegration = await getBusinessStripeIntegration(env, business.id);
      if (stripeIntegration.error || stripeIntegration.row?.status !== "verified") {
        return Response.json(
          {
            ok: false,
            error: "Online booking is temporarily unavailable for this service. Please contact the business."
          },
          { status: 503 }
        );
      }
    }

    const customer = await findOrCreatePublicCustomer({
      env,
      businessId: business.id,
      firstName,
      lastName,
      email,
      phone,
      marketingConsent
    });

    createdCustomerId = customer.created ? customer.id : null;

    const appointmentId = `apt_${crypto.randomUUID()}`;
    const startAt = `${date}T${time}:00`;
    const endAt = addMinutesToDateTime(
      date,
      time,
      Number(service.duration_minutes || 0)
    );

    const appointmentStatus = requiresOnlinePayment ? "pending" : "confirmed";
    const depositDueMinor =
      paymentTiming === "online_deposit" ? depositMinor : 0;

    if (
      paymentTiming === "online_deposit" &&
      priceMinor > 0 &&
      depositMinor <= 0
    ) {
      if (createdCustomerId) {
        await deleteUnusedCustomer(env, business.id, createdCustomerId);
      }
      return badRequest("This service's deposit amount has not been configured.");
    }

    const bufferBefore = Math.max(0, Number(business.booking_buffer_before_minutes || 0));
    const bufferAfter = Math.max(0, Number(business.booking_buffer_after_minutes || 0));

    const insert = await env.DB
      .prepare(`
        INSERT INTO appointments (
          id,
          business_id,
          customer_id,
          service_id,
          status,
          start_at,
          end_at,
          price_minor,
          deposit_due_minor,
          booking_source,
          customer_notes
        )
        SELECT
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM appointments existing
          WHERE
            existing.business_id = ?
            AND existing.status != 'cancelled'
            AND datetime(existing.start_at, '-' || ? || ' minutes') < datetime(?)
            AND datetime(existing.end_at, '+' || ? || ' minutes') > datetime(?)
        )
      `)
      .bind(
        appointmentId,
        business.id,
        customer.id,
        service.id,
        appointmentStatus,
        startAt,
        endAt,
        priceMinor,
        depositDueMinor,
        notes || null,
        business.id,
        bufferBefore,
        endAt,
        bufferAfter,
        startAt
      )
      .run();

    if (!insert.meta?.changes) {
      if (createdCustomerId) {
        await deleteUnusedCustomer(env, business.id, createdCustomerId);
      }
      return conflict("That time has just been booked. Please choose another time.");
    }

    createdAppointmentId = appointmentId;

    const booking = {
      id: appointmentId,
      service_name: service.name,
      start_at: startAt,
      end_at: endAt,
      status: appointmentStatus,
      price_minor: priceMinor,
      deposit_due_minor: depositDueMinor,
      payment_timing: paymentTiming,
      requires_consultation: Number(service.requires_consultation || 0),
      requires_patch_test: Number(service.requires_patch_test || 0)
    };

    if (!requiresOnlinePayment || priceMinor <= 0 || paymentTiming === "free") {
      await sendAppointmentCommunication({
        env,
        businessId:
          business.id,
        appointmentId,
        type:
          "booking_confirmation",
        uniqueKey:
          `booking_confirmation:${appointmentId}`,
        baseUrl:
          new URL(request.url).origin
      });

      await runServiceFormAutomation({
        env,
        businessId:
          business.id,
        appointmentId,
        triggerEvent:
          "booking_confirmed",
        baseUrl:
          new URL(request.url).origin
      });

      return Response.json({
        ok: true,
        booking,
        payment_required: false
      });
    }

    const amountMinor =
      paymentTiming === "online_deposit"
        ? Math.min(depositMinor, priceMinor)
        : priceMinor;

    if (amountMinor <= 0) {
      await env.DB
        .prepare(`
          UPDATE appointments
          SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `)
        .bind(appointmentId, business.id)
        .run();

      booking.status = "confirmed";

      await sendAppointmentCommunication({
        env,
        businessId:
          business.id,
        appointmentId,
        type:
          "booking_confirmation",
        uniqueKey:
          `booking_confirmation:${appointmentId}`,
        baseUrl:
          new URL(request.url).origin
      });

      await runServiceFormAutomation({
        env,
        businessId:
          business.id,
        appointmentId,
        triggerEvent:
          "booking_confirmed",
        baseUrl:
          new URL(request.url).origin
      });

      return Response.json({
        ok: true,
        booking,
        payment_required: false
      });
    }

    const paymentId = `pay_${crypto.randomUUID()}`;
    createdPaymentId = paymentId;
    const paymentType = paymentTiming === "online_deposit" ? "deposit" : "full";
    const currency = String(
      stripeIntegration.config?.currency || business.currency || "GBP"
    ).toLowerCase();

    await env.DB
      .prepare(`
        INSERT INTO payments (
          id,
          business_id,
          appointment_id,
          customer_id,
          provider,
          payment_type,
          amount_minor,
          currency,
          status,
          payment_method,
          notes
        )
        VALUES (?, ?, ?, ?, 'stripe', ?, ?, ?, 'pending', 'card', ?)
      `)
      .bind(
        paymentId,
        business.id,
        appointmentId,
        customer.id,
        paymentType,
        amountMinor,
        currency.toUpperCase(),
        "Public booking Stripe Checkout session created"
      )
      .run();

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set(
      "success_url",
      `${origin}/book/success/?appointment_id=${encodeURIComponent(appointmentId)}&session_id={CHECKOUT_SESSION_ID}`
    );
    params.set(
      "cancel_url",
      `${origin}/book/cancelled/?appointment_id=${encodeURIComponent(appointmentId)}&payment_id=${encodeURIComponent(paymentId)}`
    );
    params.set("customer_email", email);
    params.set("client_reference_id", appointmentId);
    params.set("expires_at", String(Math.floor(Date.now() / 1000) + 1800));
    params.set("line_items[0][price_data][currency]", currency);
    params.set("line_items[0][price_data][unit_amount]", String(amountMinor));
    params.set(
      "line_items[0][price_data][product_data][name]",
      paymentType === "deposit" ? `${service.name} deposit` : service.name
    );
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[payment_id]", paymentId);
    params.set("metadata[business_id]", business.id);
    params.set("metadata[appointment_id]", appointmentId);
    params.set("metadata[public_booking]", "1");
    params.set("payment_intent_data[metadata][payment_id]", paymentId);
    params.set("payment_intent_data[metadata][business_id]", business.id);
    params.set("payment_intent_data[metadata][appointment_id]", appointmentId);

    const stripeResult = await stripeRequest({
      secretKey: stripeIntegration.secretKey,
      path: "/v1/checkout/sessions",
      method: "POST",
      body: params
    });

    if (!stripeResult.response.ok || !stripeResult.data?.id || !stripeResult.data?.url) {
      const message = stripeErrorMessage(
        stripeResult.data,
        "Stripe Checkout could not be created."
      );

      await env.DB
        .prepare(`
          UPDATE payments
          SET status = 'failed', notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `)
        .bind(`Public booking Checkout failed: ${message}`.slice(0, 1000), paymentId, business.id)
        .run();

      await env.DB
        .prepare(`
          UPDATE appointments
          SET
            status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = 'Online payment could not be started',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ? AND status = 'pending'
        `)
        .bind(appointmentId, business.id)
        .run();

      return Response.json(
        { ok: false, error: "We couldn't start the secure payment. Please try again." },
        { status: 502 }
      );
    }

    await env.DB
      .prepare(`
        UPDATE payments
        SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `)
      .bind(stripeResult.data.id, paymentId, business.id)
      .run();

    return Response.json({
      ok: true,
      booking,
      payment_required: true,
      checkout: {
        payment_id: paymentId,
        session_id: stripeResult.data.id,
        url: stripeResult.data.url,
        amount_minor: amountMinor,
        currency: currency.toUpperCase(),
        payment_type: paymentType,
        expires_in_minutes: 30
      }
    });
  } catch (error) {
    console.error("Public booking creation failed:", error);

    // Best-effort cleanup only for records created during this request.
    try {
      if (createdPaymentId) {
        await env.DB
          .prepare(`
            UPDATE payments
            SET status = 'failed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
          `)
          .bind(createdPaymentId)
          .run();
      }

      if (createdAppointmentId) {
        await env.DB
          .prepare(`
            UPDATE appointments
            SET
              status = 'cancelled',
              cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = 'Online booking could not be completed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
          `)
          .bind(createdAppointmentId)
          .run();
      }
    } catch (cleanupError) {
      console.error("Public booking cleanup failed:", cleanupError);
    }

    return serverError("We couldn't complete the booking. Please try again.");
  }
}
