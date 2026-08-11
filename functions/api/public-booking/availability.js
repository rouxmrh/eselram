import {
  getPublicBusiness,
  getPublicService,
  getAvailableSlots,
  cleanupPendingOnlineBookings,
  validDate,
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
    const serviceId = String(url.searchParams.get("service_id") || "").trim();
    const date = String(url.searchParams.get("date") || "").trim();

    if (!serviceId || !validDate(date)) {
      return badRequest("service_id and a valid date are required.");
    }

    await cleanupPendingOnlineBookings(env, business.id);

    const service = await getPublicService(env, business.id, serviceId);
    if (!service || service.is_active !== 1) {
      return Response.json(
        { ok: false, error: "Service not found." },
        { status: 404 }
      );
    }

    const availability = await getAvailableSlots({
      env,
      business,
      service,
      date
    });

    if (availability.error) {
      return badRequest(availability.error);
    }

    return Response.json({
      ok: true,
      date,
      timezone: business.timezone,
      service: {
        id: service.id,
        name: service.name,
        duration_minutes: Number(service.duration_minutes || 0)
      },
      slots:
        availability.slots ||
        [],

      reason:
        availability.reason ||
        null
    });
  } catch (error) {
    console.error("Public booking availability failed:", error);
    return serverError("Unable to load available times.");
  }
}
