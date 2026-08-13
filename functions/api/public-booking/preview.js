import {
  getPublicBusiness,
  getPublicService,
  validEmail,
  badRequest,
  serverError
} from "../../../lib/public-booking.js";

import {
  findAvailableConsultationCredit,
  hasCompletedConsultation
} from "../../../lib/consultation-credit.js";

function clean(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

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
    const serviceId = clean(body.service_id, 120);
    const bookingIntent = clean(body.booking_intent, 20);
    const firstName = clean(body.first_name, 100);
    const lastName = clean(body.last_name, 100);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 50);

    if (!serviceId) return badRequest("Please choose a service.");
    if (!firstName || !lastName) {
      return badRequest("First and last name are required.");
    }
    if (!email || !validEmail(email)) {
      return badRequest("A valid email address is required.");
    }

    const service = await getPublicService(env, business.id, serviceId);
    if (!service || Number(service.is_active || 0) !== 1) {
      return badRequest("That service is no longer available.");
    }

    let candidates = [];
    const byEmail = await env.DB
      .prepare(`
        SELECT id, first_name, last_name, email, phone
        FROM customers
        WHERE business_id = ?
          AND lower(email) = lower(?)
        ORDER BY datetime(created_at) ASC
      `)
      .bind(business.id, email)
      .all();

    candidates = byEmail.results || [];

    if (candidates.length === 0 && phone) {
      const byPhone = await env.DB
        .prepare(`
          SELECT id, first_name, last_name, email, phone
          FROM customers
          WHERE business_id = ?
            AND phone = ?
          ORDER BY datetime(created_at) ASC
        `)
        .bind(business.id, phone)
        .all();

      candidates = byPhone.results || [];
    }

    const normalizedFirst = firstName.toLowerCase();
    const normalizedLast = lastName.toLowerCase();

    const identityMatches = candidates.filter(item =>
      String(item.first_name || "").trim().toLowerCase() === normalizedFirst &&
      String(item.last_name || "").trim().toLowerCase() === normalizedLast
    );

    // Prefer the matching customer record that actually owns the completed
    // consultation for this service. This keeps the preview aligned with the
    // consultation-credit source even if test/import data contains duplicate
    // customer identities.
    let customer = identityMatches[0] || null;

    if (
      bookingIntent === "service" &&
      Number(service.requires_consultation || 0) === 1 &&
      identityMatches.length > 1
    ) {
      for (const candidate of identityMatches) {
        const candidateCompleted = await hasCompletedConsultation({
          env,
          businessId: business.id,
          customerId: candidate.id,
          serviceId: service.id
        });

        if (candidateCompleted) {
          customer = candidate;
          break;
        }
      }
    }

    const priceMinor = Math.max(0, Number(service.price_minor || 0));
    const depositMinor = Math.max(0, Number(service.deposit_minor || 0));

    if (
      bookingIntent !== "service" ||
      Number(service.requires_consultation || 0) !== 1 ||
      !customer
    ) {
      return Response.json({
        ok: true,
        existing_customer: Boolean(customer),
        consultation_completed: false,
        consultation_credit_minor: 0,
        price_minor: priceMinor,
        deposit_minor: depositMinor,
        remaining_minor: priceMinor,
        due_today_minor:
          service.payment_timing === "online_full"
            ? priceMinor
            : service.payment_timing === "online_deposit"
              ? depositMinor
              : 0
      });
    }

    const completed = await hasCompletedConsultation({
      env,
      businessId: business.id,
      customerId: customer.id,
      serviceId: service.id
    });

    let availableMinor = 0;

    if (completed) {
      const credit = await findAvailableConsultationCredit({
        env,
        businessId: business.id,
        customerId: customer.id,
        serviceId: service.id
      });

      availableMinor = Math.max(0, Number(credit.available_minor || 0));
    }

    const appliedCredit = Math.min(availableMinor, priceMinor);
    const remainingMinor = Math.max(0, priceMinor - appliedCredit);

    let dueTodayMinor = 0;

    if (service.payment_timing === "online_full") {
      dueTodayMinor = remainingMinor;
    } else if (service.payment_timing === "online_deposit") {
      dueTodayMinor = Math.min(
        Math.max(0, depositMinor - appliedCredit),
        remainingMinor
      );
    }

    return Response.json({
      ok: true,
      existing_customer: true,
      consultation_completed: completed,
      consultation_credit_minor: appliedCredit,
      price_minor: priceMinor,
      deposit_minor: depositMinor,
      remaining_minor: remainingMinor,
      due_today_minor: dueTodayMinor
    });
  } catch (error) {
    console.error("Public booking preview failed:", error);
    return serverError("Unable to check your booking payment details.");
  }
}
