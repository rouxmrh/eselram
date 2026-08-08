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


function weekdayFromDate(dateValue) {
  const date =
    new Date(`${dateValue}T12:00:00Z`);

  const jsDay =
    date.getUTCDay();

  return jsDay === 0
    ? 7
    : jsDay;
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

    const url =
      new URL(request.url);

    const serviceId =
      String(
        url.searchParams.get(
          "service_id"
        ) || ""
      ).trim();

    const date =
      String(
        url.searchParams.get(
          "date"
        ) || ""
      ).trim();

    const excludeAppointmentId =
  String(
    url.searchParams.get(
      "exclude_appointment_id"
    ) || ""
  ).trim();
    
    if (
      !serviceId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "service_id and date are required."
        },
        {
          status: 400
        }
      );
    }

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
          user.business_id
        )
        .first();

    if (
      !service ||
      service.is_active !== 1
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Service not found."
        },
        {
          status: 404
        }
      );
    }

    const business =
      await env.DB
        .prepare(`
          SELECT
            timezone,
            booking_buffer_before_minutes,
            booking_buffer_after_minutes
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `)
        .bind(
          user.business_id
        )
        .first();

    const weekday =
      weekdayFromDate(date);

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
          user.business_id,
          weekday
        )
        .first();

    if (
      !hours ||
      hours.is_open !== 1
    ) {
      return Response.json({
        ok: true,
        date,
        service: {
          id: service.id,
          name: service.name,
          duration_minutes:
            service.duration_minutes
        },
        timezone:
          business?.timezone ||
          "Europe/London",
        slots: []
      });
    }

    let appointmentsQuery = `
  SELECT
    id,
    start_at,
    end_at

  FROM appointments

  WHERE
    business_id = ?
    AND status != 'cancelled'
    AND date(start_at) = ?
`;


const appointmentBindings = [
  user.business_id,
  date
];


if (
  excludeAppointmentId
) {

  appointmentsQuery += `
    AND id != ?
  `;

  appointmentBindings.push(
    excludeAppointmentId
  );
}


appointmentsQuery += `
  ORDER BY
    datetime(start_at) ASC
`;


const appointments =
  await env.DB
    .prepare(
      appointmentsQuery
    )
    .bind(
      ...appointmentBindings
    )
    .all();

    const interval =
      Number(
        hours.booking_interval_minutes ||
        30
      );

    const duration =
      Number(
        service.duration_minutes
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

    return Response.json({
      ok: true,

      date,

      service: {
        id: service.id,
        name: service.name,
        duration_minutes:
          service.duration_minutes
      },

      timezone:
        business?.timezone ||
        "Europe/London",

      booking_interval_minutes:
        interval,

      buffer_before_minutes:
        bufferBefore,

      buffer_after_minutes:
        bufferAfter,

      slots
    });

  } catch (error) {
    console.error(
      "Availability lookup failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load availability."
      },
      {
        status: 500
      }
    );
  }
}
