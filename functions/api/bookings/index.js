import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";


async function getUserContext(
  request,
  env
) {
  const token =
    readSessionToken(request);

  if (!token) {
    return null;
  }

  const tokenHash =
    await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}


function unauthorized() {
  return Response.json(
    {
      ok: false,
      error: "Authentication required."
    },
    {
      status: 401
    }
  );
}


function badRequest(message) {
  return Response.json(
    {
      ok: false,
      error: message
    },
    {
      status: 400
    }
  );
}


function timeToMinutes(value) {
  const [hours, minutes] =
    value.split(":").map(Number);

  return (hours * 60) + minutes;
}


function minutesToTime(minutes) {
  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}


function addMinutesToDateTime(
  date,
  time,
  minutes
) {
  const [hour, minute] =
    time.split(":").map(Number);

  const value =
    new Date(
      `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
    );

  value.setMinutes(
    value.getMinutes() + minutes
  );

  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      value.getDate()
    ).padStart(2, "0");

  const hours =
    String(
      value.getHours()
    ).padStart(2, "0");

  const mins =
    String(
      value.getMinutes()
    ).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${mins}:00`;
}


async function getAvailableSlots({
  env,
  businessId,
  serviceId,
  date
}) {
  const service =
    await env.DB
      .prepare(`
        SELECT
          id,
          name,
          duration_minutes,
          is_active

        FROM services

        WHERE
          id = ?
          AND business_id = ?

        LIMIT 1
      `)
      .bind(
        serviceId,
        businessId
      )
      .first();

  if (
    !service ||
    service.is_active !== 1
  ) {
    return {
      error: "Service not found."
    };
  }

  const business =
    await env.DB
      .prepare(`
        SELECT
          booking_buffer_before_minutes,
          booking_buffer_after_minutes

        FROM businesses

        WHERE id = ?

        LIMIT 1
      `)
      .bind(businessId)
      .first();

  const dateObject =
    new Date(
      `${date}T12:00:00Z`
    );

  const jsDay =
    dateObject.getUTCDay();

  const weekday =
    jsDay === 0
      ? 7
      : jsDay;

  const hours =
    await env.DB
      .prepare(`
        SELECT
          is_open,
          open_time,
          close_time,
          booking_interval_minutes

        FROM working_hours

        WHERE
          business_id = ?
          AND weekday = ?

        LIMIT 1
      `)
      .bind(
        businessId,
        weekday
      )
      .first();

  if (
    !hours ||
    hours.is_open !== 1
  ) {
    return {
      service,
      slots: []
    };
  }

  const appointments =
    await env.DB
      .prepare(`
        SELECT
          start_at,
          end_at

        FROM appointments

        WHERE
          business_id = ?
          AND status != 'cancelled'
          AND date(start_at) = ?

        ORDER BY datetime(start_at) ASC
      `)
      .bind(
        businessId,
        date
      )
      .all();

  const duration =
    Number(
      service.duration_minutes
    );

  const interval =
    Number(
      hours.booking_interval_minutes ||
      30
    );

  const bufferBefore =
    Number(
      business
        ?.booking_buffer_before_minutes ||
      0
    );

  const bufferAfter =
    Number(
      business
        ?.booking_buffer_after_minutes ||
      0
    );

  const openMinutes =
    timeToMinutes(
      hours.open_time
    );

  const closeMinutes =
    timeToMinutes(
      hours.close_time
    );

  const busyRanges =
    (appointments.results || [])
      .map((appointment) => {
        const start =
          new Date(
            appointment.start_at
          );

        const end =
          new Date(
            appointment.end_at
          );

        return {
          start:
            (start.getHours() * 60) +
            start.getMinutes() -
            bufferBefore,

          end:
            (end.getHours() * 60) +
            end.getMinutes() +
            bufferAfter
        };
      });

  const slots = [];

  for (
    let start = openMinutes;
    start + duration <= closeMinutes;
    start += interval
  ) {
    const end =
      start + duration;

    const clashes =
      busyRanges.some(
        (range) =>
          start < range.end &&
          end > range.start
      );

    if (!clashes) {
      slots.push(
        minutesToTime(start)
      );
    }
  }

  return {
    service,
    slots
  };
}


export async function onRequestGet({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return unauthorized();
    }

    const bookings =
      await env.DB
        .prepare(`
          SELECT
            a.id,
            a.start_at,
            a.end_at,
            a.status,
            a.customer_notes AS notes,

            c.id AS customer_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,

            s.id AS service_id,
            s.name AS service_name,
            s.duration_minutes,
            s.price_minor

          FROM appointments a

          JOIN customers c
            ON c.id = a.customer_id

          JOIN services s
            ON s.id = a.service_id

          WHERE
            a.business_id = ?

          ORDER BY
            datetime(a.start_at) ASC
        `)
        .bind(
          user.business_id
        )
        .all();

    return Response.json({
      ok: true,
      bookings:
        bookings.results || []
    });

  } catch (error) {
    console.error(
      "Bookings GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load bookings."
      },
      {
        status: 500
      }
    );
  }
}


export async function onRequestPost({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return unauthorized();
    }

    const body =
      await request.json();

    const serviceId =
      String(
        body.service_id || ""
      ).trim();

    const date =
      String(
        body.date || ""
      ).trim();

    const time =
      String(
        body.time || ""
      ).trim();

    const firstName =
      String(
        body.first_name || ""
      ).trim();

    const lastName =
      String(
        body.last_name || ""
      ).trim();

    const email =
      String(
        body.email || ""
      ).trim();

    const phone =
      String(
        body.phone || ""
      ).trim();

    const notes =
      String(
        body.notes || ""
      ).trim();

    if (!serviceId) {
      return badRequest(
        "Service is required."
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(date)
    ) {
      return badRequest(
        "A valid date is required."
      );
    }

    if (
      !/^\d{2}:\d{2}$/
        .test(time)
    ) {
      return badRequest(
        "A valid time is required."
      );
    }

    if (!firstName) {
      return badRequest(
        "First name is required."
      );
    }

    if (!email && !phone) {
      return badRequest(
        "An email address or phone number is required."
      );
    }

    const availability =
      await getAvailableSlots({
        env,
        businessId:
          user.business_id,
        serviceId,
        date
      });

    if (availability.error) {
      return badRequest(
        availability.error
      );
    }

    if (
      !availability.slots
        .includes(time)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "That time is no longer available."
        },
        {
          status: 409
        }
      );
    }

    let customer = null;

    if (email) {
      customer =
        await env.DB
          .prepare(`
            SELECT id

            FROM customers

            WHERE
              business_id = ?
              AND lower(email) =
                  lower(?)

            LIMIT 1
          `)
          .bind(
            user.business_id,
            email
          )
          .first();
    }

    const customerId =
      customer?.id ||
      `cus_${crypto.randomUUID()}`;

    if (!customer) {
      await env.DB
        .prepare(`
          INSERT INTO customers (
            id,
            business_id,
            first_name,
            last_name,
            email,
            phone
          )

          VALUES (
            ?, ?, ?, ?, ?, ?
          )
        `)
        .bind(
          customerId,
          user.business_id,
          firstName,
          lastName || null,
          email || null,
          phone || null
        )
        .run();
    }

    const appointmentId =
      `apt_${crypto.randomUUID()}`;

    const startAt =
      `${date}T${time}:00`;

    const endAt =
      addMinutesToDateTime(
        date,
        time,
        Number(
          availability.service
            .duration_minutes
        )
      );

    await env.DB
      .prepare(`
        INSERT INTO appointments (
          id,
          business_id,
          customer_id,
          service_id,
          start_at,
          end_at,
          status,
          notes
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, 'confirmed', ?
        )
      `)
      .bind(
        appointmentId,
        user.business_id,
        customerId,
        serviceId,
        startAt,
        endAt,
        notes || null
      )
      .run();

    return Response.json({
      ok: true,
      booking: {
        id:
          appointmentId,
        customer_id:
          customerId,
        service_id:
          serviceId,
        start_at:
          startAt,
        end_at:
          endAt,
        status:
          "confirmed"
      }
    });

  } catch (error) {
    console.error(
      "Booking creation failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to create booking."
      },
      {
        status: 500
      }
    );
  }
}
