export function badRequest(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 400 }
  );
}

export function conflict(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 409 }
  );
}

export function serverError(message = "Unable to complete this request.") {
  return Response.json(
    { ok: false, error: message },
    { status: 500 }
  );
}

export async function getPublicBusiness(env) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        website,
        timezone,
        currency,
        locale,
        booking_buffer_before_minutes,
        booking_buffer_after_minutes
      FROM businesses
      WHERE status = 'active'
      ORDER BY datetime(created_at) ASC
      LIMIT 1
    `)
    .first();
}


export async function getPublicBookingRules(
  env,
  businessId
) {
  const rows =
    await env.DB
      .prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key IN (
            'public_booking_enabled',
            'public_booking_minimum_notice_hours',
            'public_booking_max_advance_days',
            'public_booking_blocked_dates'
          )
      `)
      .bind(businessId)
      .all();

  const map =
    Object.fromEntries(
      (
        rows.results ||
        []
      ).map(
        (row) => [
          row.setting_key,
          row.setting_value
        ]
      )
    );

  let blockedDates = [];

  try {
    blockedDates =
      JSON.parse(
        map.public_booking_blocked_dates ||
        "[]"
      );
  } catch {
    blockedDates = [];
  }

  return {
    enabled:
      map.public_booking_enabled ===
        undefined ||
      map.public_booking_enabled ===
        "1" ||
      String(
        map.public_booking_enabled
      ).toLowerCase() ===
        "true",

    minimum_notice_hours:
      Math.max(
        0,
        Number(
          map.public_booking_minimum_notice_hours ??
          2
        ) || 0
      ),

    max_advance_days:
      Math.max(
        1,
        Number(
          map.public_booking_max_advance_days ??
          90
        ) || 90
      ),

    blocked_dates:
      (
        Array.isArray(
          blockedDates
        )
          ? blockedDates
          : []
      )
        .filter(
          (item) =>
            item &&
            /^\d{4}-\d{2}-\d{2}$/.test(
              String(
                item.date ||
                ""
              )
            )
        )
        .map(
          (item) => ({
            date:
              String(item.date),
            reason:
              String(
                item.reason ||
                ""
              ).trim()
          })
        )
  };
}

function dayNumber(dateValue) {
  const [
    year,
    month,
    day
  ] =
    String(dateValue)
      .split("-")
      .map(Number);

  return Math.floor(
    Date.UTC(
      year,
      month - 1,
      day
    ) /
    86400000
  );
}

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function validTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

export function validEmail(value) {
  const text = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (hours * 60) + minutes;
}

export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function addMinutesToDateTime(date, time, minutes) {
  const [hour, minute] = String(time).split(":").map(Number);
  const value = new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
  );
  value.setMinutes(value.getMinutes() + Number(minutes || 0));

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const mins = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${mins}:00`;
}

export function localDateTimeParts(timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minutes: (Number(parts.hour) * 60) + Number(parts.minute)
  };
}

export async function cleanupPendingOnlineBookings(env, businessId) {
  // Promote successful online bookings if the Stripe webhook has already
  // marked their payment paid, even if the customer closed the success page.
  await env.DB
    .prepare(`
      UPDATE appointments
      SET
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
      WHERE
        business_id = ?
        AND booking_source = 'online'
        AND status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM payments p
          WHERE
            p.appointment_id = appointments.id
            AND p.business_id = appointments.business_id
            AND p.status IN ('paid', 'partially_refunded', 'refunded')
            AND p.payment_type != 'refund'
        )
    `)
    .bind(businessId)
    .run();

  // Public Checkout sessions created by Public Booking v1 expire after 30 min.
  // Give webhooks a small grace period before releasing the slot.
  await env.DB
    .prepare(`
      UPDATE appointments
      SET
        status = 'cancelled',
        cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP),
        cancellation_reason = COALESCE(
          cancellation_reason,
          'Online booking payment was not completed'
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE
        business_id = ?
        AND booking_source = 'online'
        AND status = 'pending'
        AND datetime(created_at) < datetime('now', '-35 minutes')
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
    .bind(businessId)
    .run();
}

export async function getPublicService(env, businessId, serviceId) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        description,
        duration_minutes,
        price_minor,
        deposit_minor,
        payment_timing,
        requires_consultation,
        requires_patch_test,
        is_active,
        sort_order
      FROM services
      WHERE id = ? AND business_id = ?
      LIMIT 1
    `)
    .bind(serviceId, businessId)
    .first();
}

export async function getAvailableSlots({
  env,
  business,
  service,
  date,
  excludeAppointmentId = null
}) {
  if (!validDate(date)) {
    return { error: "A valid date is required." };
  }

  const rules =
    await getPublicBookingRules(
      env,
      business.id
    );

  if (!rules.enabled) {
    return {
      slots: [],
      reason:
        "Online booking is currently unavailable."
    };
  }

  const nowLocal =
    localDateTimeParts(
      business.timezone
    );

  const daysAhead =
    dayNumber(date) -
    dayNumber(
      nowLocal.date
    );

  if (daysAhead < 0) {
    return {
      slots: [],
      reason:
        "This date has already passed."
    };
  }

  if (
    daysAhead >
    Number(
      rules.max_advance_days ||
      90
    )
  ) {
    return {
      slots: [],
      reason:
        `Online bookings can only be made up to ${
          Number(
            rules.max_advance_days ||
            90
          )
        } days ahead.`
    };
  }

  const blockedDate =
    (
      rules.blocked_dates ||
      []
    ).find(
      (item) =>
        item.date === date
    );

  if (blockedDate) {
    return {
      slots: [],
      reason:
        blockedDate.reason
          ? `This date is unavailable: ${blockedDate.reason}.`
          : "This date is unavailable."
    };
  }

  const dateObject = new Date(`${date}T12:00:00Z`);
  const jsDay = dateObject.getUTCDay();
  const weekday = jsDay === 0 ? 7 : jsDay;

  const hours = await env.DB
    .prepare(`
      SELECT
        is_open,
        open_time,
        close_time,
        booking_interval_minutes
      FROM working_hours
      WHERE business_id = ? AND weekday = ?
      LIMIT 1
    `)
    .bind(business.id, weekday)
    .first();

  if (!hours || hours.is_open !== 1 || !hours.open_time || !hours.close_time) {
    return { slots: [], booking_interval_minutes: 30 };
  }

  const appointments = await env.DB
    .prepare(`
      SELECT start_at, end_at
      FROM appointments
      WHERE
        business_id = ?
        AND status != 'cancelled'
        AND date(start_at) = ?
        AND (
          ? IS NULL
          OR id != ?
        )
      ORDER BY datetime(start_at) ASC
    `)
    .bind(
      business.id,
      date,
      excludeAppointmentId || null,
      excludeAppointmentId || null
    )
    .all();

  const duration = Number(service.duration_minutes || 0);
  const interval = Number(hours.booking_interval_minutes || 30);
  const bufferBefore = Number(business.booking_buffer_before_minutes || 0);
  const bufferAfter = Number(business.booking_buffer_after_minutes || 0);
  const openMinutes = timeToMinutes(hours.open_time);
  const closeMinutes = timeToMinutes(hours.close_time);

  const busyRanges = (appointments.results || []).map((appointment) => {
    const start = new Date(appointment.start_at);
    const end = new Date(appointment.end_at);
    return {
      start: (start.getHours() * 60) + start.getMinutes() - bufferBefore,
      end: (end.getHours() * 60) + end.getMinutes() + bufferAfter
    };
  });

  const slots = [];
  for (
    let start = openMinutes;
    start + duration <= closeMinutes;
    start += interval
  ) {
    if (date === nowLocal.date && start <= nowLocal.minutes) {
      continue;
    }

    const targetMinuteNumber =
      (
        dayNumber(date) *
        1440
      ) +
      start;

    const nowMinuteNumber =
      (
        dayNumber(
          nowLocal.date
        ) *
        1440
      ) +
      nowLocal.minutes;

    const leadMinutes =
      targetMinuteNumber -
      nowMinuteNumber;

    if (
      leadMinutes <
      (
        Number(
          rules.minimum_notice_hours ||
          0
        ) *
        60
      )
    ) {
      continue;
    }

    const end = start + duration;
    const clashes = busyRanges.some(
      (range) => start < range.end && end > range.start
    );

    if (!clashes) {
      slots.push(minutesToTime(start));
    }
  }

  return {
    slots,
    booking_interval_minutes: interval,
    reason:
      slots.length
        ? null
        : (
            Number(
              rules.minimum_notice_hours ||
              0
            ) > 0 &&
            daysAhead <= 1
              ? "No appointment times meet the minimum booking notice on this date."
              : null
          )
  };
}

export async function findOrCreatePublicCustomer({
  env,
  businessId,
  firstName,
  lastName,
  email,
  phone,
  marketingConsent
}) {
  let existing = null;

  if (email) {
    existing = await env.DB
      .prepare(`
        SELECT id, first_name, last_name, email, phone
        FROM customers
        WHERE business_id = ? AND lower(email) = lower(?)
        LIMIT 1
      `)
      .bind(businessId, email)
      .first();
  }

  if (!existing && phone) {
    existing = await env.DB
      .prepare(`
        SELECT id, first_name, last_name, email, phone
        FROM customers
        WHERE business_id = ? AND phone = ?
        LIMIT 1
      `)
      .bind(businessId, phone)
      .first();
  }

  if (existing) {
    await env.DB
      .prepare(`
        UPDATE customers
        SET
          first_name = ?,
          last_name = ?,
          email = COALESCE(NULLIF(?, ''), email),
          phone = COALESCE(NULLIF(?, ''), phone),
          marketing_consent = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `)
      .bind(
        firstName,
        lastName,
        email,
        phone,
        marketingConsent ? 1 : 0,
        existing.id,
        businessId
      )
      .run();

    return { id: existing.id, created: false };
  }

  const id = `cus_${crypto.randomUUID()}`;
  await env.DB
    .prepare(`
      INSERT INTO customers (
        id,
        business_id,
        first_name,
        last_name,
        email,
        phone,
        marketing_consent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      businessId,
      firstName,
      lastName,
      email || null,
      phone || null,
      marketingConsent ? 1 : 0
    )
    .run();

  return { id, created: true };
}

export async function deleteUnusedCustomer(env, businessId, customerId) {
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
    .bind(customerId, businessId)
    .run();
}
