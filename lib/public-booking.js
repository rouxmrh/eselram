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
        .map(
          (item) => {
            const legacyDate =
              String(
                item?.date ||
                ""
              ).trim();

            const startDate =
              String(
                item?.start_date ||
                legacyDate ||
                ""
              ).trim();

            const endDate =
              String(
                item?.end_date ||
                legacyDate ||
                startDate ||
                ""
              ).trim();

            return {
              start_date:
                startDate,
              end_date:
                endDate,
              reason:
                String(
                  item?.reason ||
                  ""
                ).trim()
            };
          }
        )
        .filter(
          (item) =>
            /^\d{4}-\d{2}-\d{2}$/.test(
              item.start_date
            ) &&
            /^\d{4}-\d{2}-\d{2}$/.test(
              item.end_date
            ) &&
            item.start_date <=
              item.end_date
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

  // Stripe Checkout sessions created by Public Booking expire after 30 min.
  // Give webhooks a 5 minute grace period, then completely remove an unpaid
  // provisional online booking instead of turning it into a real cancelled
  // appointment/payment record. This keeps abandoned Checkout attempts out of
  // the operational database as well as out of staff-facing screens.
  const stale = await env.DB
    .prepare(`
      SELECT
        a.id,
        a.customer_id,
        CASE
          WHEN ABS((julianday(a.created_at) - julianday(c.created_at)) * 86400) <= 120
          THEN 1 ELSE 0
        END AS customer_created_for_checkout
      FROM appointments a
      JOIN customers c
        ON c.id = a.customer_id
       AND c.business_id = a.business_id
      WHERE
        a.business_id = ?
        AND a.booking_source = 'online'
        AND datetime(a.created_at) < datetime('now', '-35 minutes')
        AND (
          a.status = 'pending'
          OR (
            a.status = 'cancelled'
            AND a.cancellation_reason IN (
              'Online booking payment was not completed',
              'Customer left online payment before completion',
              'Online payment could not be started',
              'Online booking could not be completed'
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM payments p
          WHERE
            p.appointment_id = a.id
            AND p.business_id = a.business_id
            AND p.status IN ('paid', 'partially_refunded', 'refunded')
            AND p.payment_type != 'refund'
        )
    `)
    .bind(businessId)
    .all();

  const staleRows = Array.isArray(stale?.results) ? stale.results : [];
  if (!staleRows.length) return;

  // D1 has a bound-parameter limit, so clean in small batches.
  for (let offset = 0; offset < staleRows.length; offset += 50) {
    const batch = staleRows.slice(offset, offset + 50);
    const ids = batch.map((row) => String(row.id || '')).filter(Boolean);
    if (!ids.length) continue;

    const placeholders = ids.map(() => '?').join(', ');

    // Remember only customers that were created at essentially the same time
    // as the provisional public booking. That distinguishes customers created
    // by this checkout from established/manual customers who later used /book.
    const provisionalCustomerIds = batch
      .filter((row) => Number(row.customer_created_for_checkout || 0) === 1)
      .map((row) => String(row.customer_id || ''))
      .filter(Boolean);

    // Delete only unpaid technical payment attempts attached to these
    // provisional bookings. A paid/refunded payment is never removed.
    await env.DB
      .prepare(`
        DELETE FROM payments
        WHERE
          business_id = ?
          AND appointment_id IN (${placeholders})
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `)
      .bind(businessId, ...ids)
      .run();

    await env.DB
      .prepare(`
        DELETE FROM appointments
        WHERE
          business_id = ?
          AND booking_source = 'online'
          AND id IN (${placeholders})
          AND status IN ('pending', 'cancelled')
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
      .bind(businessId, ...ids)
      .run();

    // If that checkout created a brand-new customer and the customer now has
    // no genuine booking/payment left, remove the orphan customer as well.
    // Established/manual customers are preserved.
    for (const customerId of [...new Set(provisionalCustomerIds)]) {
      await deleteUnusedCustomer(env, businessId, customerId);
    }
  }
}

export async function getPublicService(env, businessId, serviceId) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        description,
        booking_group,
        service_type,
        consultation_service_id,
        post_consultation_booking,
        duration_minutes,
        price_minor,
        deposit_minor,
        payment_timing,
        consultation_duration_minutes,
        consultation_price_minor,
        consultation_payment_timing,
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
        date >= item.start_date &&
        date <= item.end_date
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

export async function findVerifiedExistingPublicCustomer({
  env,
  businessId,
  firstName,
  lastName,
  email,
  phone
}) {
  const normalizedFirstName =
    String(firstName || "").trim().toLowerCase();

  const normalizedLastName =
    String(lastName || "").trim().toLowerCase();

  const normalizedEmail =
    String(email || "").trim().toLowerCase();

  const normalizedPhone =
    String(phone || "").trim();

  if (
    !normalizedFirstName ||
    !normalizedLastName ||
    !normalizedEmail ||
    !normalizedPhone
  ) {
    return null;
  }

  return await env.DB
    .prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone

      FROM customers

      WHERE
        business_id = ?
        AND lower(trim(COALESCE(first_name, ''))) = ?
        AND lower(trim(COALESCE(last_name, ''))) = ?
        AND lower(trim(COALESCE(email, ''))) = ?
        AND trim(COALESCE(phone, '')) = ?

      ORDER BY
        datetime(created_at) ASC

      LIMIT 1
    `)
    .bind(
      businessId,
      normalizedFirstName,
      normalizedLastName,
      normalizedEmail,
      normalizedPhone
    )
    .first();
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
  const normalizedFirstName =
    String(
      firstName ||
      ""
    )
      .trim()
      .toLowerCase();

  const normalizedLastName =
    String(
      lastName ||
      ""
    )
      .trim()
      .toLowerCase();

  let candidates = [];


  if (email) {
    const rows =
      await env.DB
        .prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            marketing_consent

          FROM customers

          WHERE
            business_id = ?
            AND lower(email) =
                lower(?)

          ORDER BY
            datetime(created_at) ASC
        `)
        .bind(
          businessId,
          email
        )
        .all();

    candidates =
      rows.results ||
      [];
  }


  if (
    candidates.length === 0 &&
    phone
  ) {
    const rows =
      await env.DB
        .prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            marketing_consent

          FROM customers

          WHERE
            business_id = ?
            AND phone = ?

          ORDER BY
            datetime(created_at) ASC
        `)
        .bind(
          businessId,
          phone
        )
        .all();

    candidates =
      rows.results ||
      [];
  }


  const existing =
    candidates.find(
      (customer) =>
        String(
          customer.first_name ||
          ""
        )
          .trim()
          .toLowerCase() ===
          normalizedFirstName &&
        String(
          customer.last_name ||
          ""
        )
          .trim()
          .toLowerCase() ===
          normalizedLastName
    ) ||
    null;


  if (existing) {
    /*
     * Public booking/package purchase must never overwrite an
     * established customer's identity.
     *
     * Matching requires both:
     *   1. the same email or phone lookup, and
     *   2. the same first + last name.
     *
     * We only fill missing contact details and preserve any existing
     * name/contact information already held on the customer record.
     */
    await env.DB
      .prepare(`
        UPDATE customers

        SET
          email =
            COALESCE(
              NULLIF(email, ''),
              NULLIF(?, '')
            ),

          phone =
            COALESCE(
              NULLIF(phone, ''),
              NULLIF(?, '')
            ),

          marketing_consent =
            CASE
              WHEN marketing_consent = 1
                THEN 1
              WHEN ? = 1
                THEN 1
              ELSE 0
            END,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        email,
        phone,
        marketingConsent
          ? 1
          : 0,
        existing.id,
        businessId
      )
      .run();

    return {
      id:
        existing.id,
      created:
        false
    };
  }


  /*
   * If the email/phone belongs to a differently named customer,
   * create a separate customer rather than renaming or merging
   * the existing record.
   *
   * Shared household emails/phone numbers and test accounts are
   * therefore safe.
   */
  const id =
    `cus_${
      crypto.randomUUID()
    }`;


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

      VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )
    `)
    .bind(
      id,
      businessId,
      firstName,
      lastName,
      email ||
      null,
      phone ||
      null,
      marketingConsent
        ? 1
        : 0
    )
    .run();


  return {
    id,
    created:
      true
  };
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
