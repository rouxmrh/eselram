import {
  getPublicBusiness,
  getPublicService,
  getAvailableSlots,
  cleanupPendingOnlineBookings,
  findOrCreatePublicCustomer,
  findVerifiedExistingPublicCustomer,
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
  findAvailableConsultationCredit,
  hasCompletedConsultation
} from "../../../lib/consultation-credit.js";

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
    const bookingIntent = clean(body.booking_intent, 20);

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

    if (
      bookingIntent === "service" &&
      Number(service.requires_consultation || 0) === 1 &&
      String(service.post_consultation_booking || "client_can_book") === "practitioner_managed"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This treatment is managed by the practitioner after consultation. Please contact the business to arrange treatment.",
          practitioner_managed: true
        },
        { status: 409 }
      );
    }

    let verifiedExistingCustomer = null;

    if (
      Number(service.requires_consultation || 0) === 1 &&
      bookingIntent === "service"
    ) {
      verifiedExistingCustomer =
        await findVerifiedExistingPublicCustomer({
          env,
          businessId: business.id,
          firstName,
          lastName,
          email,
          phone
        });

      if (!verifiedExistingCustomer) {
        return Response.json(
          {
            ok: false,
            error:
              "We could not verify you as an existing client for this treatment. Please use the same first name, last name, email address and phone number held on your customer record, or book a consultation.",
            consultation_required: true
          },
          { status: 409 }
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

    let consultationCompleted = false;
    let consultationCreditSourceAppointmentId = null;
    let consultationCreditMinor = 0;

    if (
      Number(service.requires_consultation || 0) === 1
    ) {
      consultationCompleted =
        await hasCompletedConsultation({
          env,
          businessId: business.id,
          customerId: customer.id,
          serviceId: service.id
        });
    }

    let bookingKind = "service";

    if (
      Number(service.requires_consultation || 0) === 1
    ) {
      if (bookingIntent === "consultation") {
        bookingKind = "consultation";
      } else if (bookingIntent === "service") {
        if (!consultationCompleted) {
          if (createdCustomerId) {
            await deleteUnusedCustomer(
              env,
              business.id,
              createdCustomerId
            );
          }

          return Response.json(
            {
              ok: false,
              error:
                "Your customer details were recognised, but we could not find a completed consultation for this treatment. Please choose Book consultation.",
              consultation_required: true
            },
            { status: 409 }
          );
        }

        bookingKind = "service";
      } else {
        bookingKind = consultationCompleted
          ? "service"
          : "consultation";
      }
    }

    if (bookingKind === "service") {
      const availableCredit =
        await findAvailableConsultationCredit({
          env,
          businessId: business.id,
          customerId: customer.id,
          serviceId: service.id
        });

      consultationCreditSourceAppointmentId =
        availableCredit.source_appointment_id;
      consultationCreditMinor =
        Number(availableCredit.available_minor || 0);
    }

    const bookingDuration =
      bookingKind ===
        "consultation"
        ? Number(
            service.consultation_duration_minutes ||
            30
          )
        : Number(
            service.duration_minutes ||
            0
          );

    const paymentTiming =
      bookingKind ===
        "consultation"
        ? String(
            service.consultation_payment_timing ||
            "free"
          )
        : String(
            service.payment_timing ||
            "pay_at_appointment"
          );

    const priceMinor =
      bookingKind ===
        "consultation"
        ? Math.max(
            0,
            Number(
              service.consultation_price_minor ||
              0
            )
          )
        : Math.max(
            0,
            Number(
              service.price_minor ||
              0
            )
          );

    const depositMinor =
      bookingKind ===
        "consultation"
        ? 0
        : Math.max(
            0,
            Number(
              service.deposit_minor ||
              0
            )
          );

    // A paid completed consultation is a one-time credit against the first
    // later treatment for the same service. Keep the appointment value at
    // the full treatment price and record the credit separately.
    const appliedConsultationCreditMinor =
      bookingKind === "service"
        ? Math.min(consultationCreditMinor, priceMinor)
        : 0;

    const outstandingAfterCreditMinor =
      Math.max(0, priceMinor - appliedConsultationCreditMinor);

    const effectiveDepositMinor =
      Math.max(0, depositMinor - appliedConsultationCreditMinor);

    const effectiveService = {
      ...service,
      duration_minutes:
        bookingDuration
    };

    const availability =
      await getAvailableSlots({
        env,
        business,
        service:
          effectiveService,
        date
      });

    if (availability.error) {
      if (createdCustomerId) {
        await deleteUnusedCustomer(
          env,
          business.id,
          createdCustomerId
        );
      }

      return badRequest(
        availability.error
      );
    }

    if (
      !(availability.slots || [])
        .includes(time)
    ) {
      if (createdCustomerId) {
        await deleteUnusedCustomer(
          env,
          business.id,
          createdCustomerId
        );
      }

      return conflict(
        availability.reason ||
        "That time is no longer available. Please choose another time."
      );
    }

    const requiresOnlinePayment =
      paymentTiming ===
        "online_deposit" ||
      paymentTiming ===
        "online_full";

    let stripeIntegration = null;

    if (requiresOnlinePayment) {
      const providerLink =
        await env.DB
          .prepare(`
            SELECT 1
            FROM service_payment_providers
            WHERE
              service_id = ?
              AND provider_key =
                  'stripe'
            LIMIT 1
          `)
          .bind(
            service.id
          )
          .first();

      if (!providerLink) {
        if (createdCustomerId) {
          await deleteUnusedCustomer(
            env,
            business.id,
            createdCustomerId
          );
        }

        return badRequest(
          "Online payment is not configured for this service."
        );
      }

      stripeIntegration =
        await getBusinessStripeIntegration(
          env,
          business.id
        );

      if (
        stripeIntegration.error ||
        stripeIntegration.row?.status !==
          "verified"
      ) {
        if (createdCustomerId) {
          await deleteUnusedCustomer(
            env,
            business.id,
            createdCustomerId
          );
        }

        return Response.json(
          {
            ok: false,
            error:
              "Online booking is temporarily unavailable for this service. Please contact the business."
          },
          {
            status: 503
          }
        );
      }
    }

    const appointmentId = `apt_${crypto.randomUUID()}`;
    const startAt = `${date}T${time}:00`;
    const endAt = addMinutesToDateTime(
      date,
      time,
      bookingDuration
    );

    const appointmentStatus = requiresOnlinePayment ? "pending" : "confirmed";
    const depositDueMinor =
      paymentTiming === "online_deposit" ? effectiveDepositMinor : 0;

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
          customer_notes,
          booking_kind,
          consultation_credit_source_appointment_id,
          consultation_credit_minor
        )
        SELECT
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?, ?, ?
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
        bookingKind,
        bookingKind === "service" ? consultationCreditSourceAppointmentId : null,
        appliedConsultationCreditMinor,
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
      consultation_credit_minor: appliedConsultationCreditMinor,
      payment_timing: paymentTiming,
      booking_kind:
        bookingKind,
      booking_label:
        bookingKind ===
          "consultation"
          ? `Consultation · ${service.name}`
          : service.name,
      requires_consultation: Number(service.requires_consultation || 0),
      requires_patch_test: Number(service.requires_patch_test || 0)
    };

    if (!requiresOnlinePayment || outstandingAfterCreditMinor <= 0 || paymentTiming === "free") {
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
        ? Math.min(effectiveDepositMinor, outstandingAfterCreditMinor)
        : outstandingAfterCreditMinor;

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
      bookingKind === "consultation"
        ? `${service.name} consultation`
        : (
            paymentType === "deposit"
              ? `${service.name} deposit`
              : service.name
          )
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
