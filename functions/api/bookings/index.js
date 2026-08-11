import {
  sendAppointmentCommunication
} from "../../../lib/communications.js";

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


function notFound(message) {

  return Response.json(
    {
      ok: false,
      error: message
    },
    {
      status: 404
    }
  );
}


function conflict(message) {

  return Response.json(
    {
      ok: false,
      error: message
    },
    {
      status: 409
    }
  );
}


function timeToMinutes(value) {

  const [hours, minutes] =
    String(value)
      .split(":")
      .map(Number);


  return (
    hours * 60
  ) + minutes;
}


function minutesToTime(minutes) {

  const hours =
    Math.floor(
      minutes / 60
    );

  const mins =
    minutes % 60;


  return `${
    String(hours)
      .padStart(2, "0")
  }:${
    String(mins)
      .padStart(2, "0")
  }`;
}


function addMinutesToDateTime(
  date,
  time,
  minutes
) {

  const [hour, minute] =
    String(time)
      .split(":")
      .map(Number);


  const value =
    new Date(
      `${date}T${
        String(hour)
          .padStart(2, "0")
      }:${
        String(minute)
          .padStart(2, "0")
      }:00`
    );


  value.setMinutes(
    value.getMinutes() +
    minutes
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


function isValidDate(value) {

  return /^\d{4}-\d{2}-\d{2}$/
    .test(value);
}


function isValidTime(value) {

  return /^\d{2}:\d{2}$/
    .test(value);
}


async function getService(
  env,
  businessId,
  serviceId
) {

  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        duration_minutes,
        price_minor,
        deposit_minor,
        payment_timing,
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
}


async function getAvailableSlots({
  env,
  businessId,
  serviceId,
  date,
  excludeAppointmentId = null
}) {

  const service =
    await getService(
      env,
      businessId,
      serviceId
    );


  if (
    !service ||
    service.is_active !== 1
  ) {

    return {
      error:
        "Service not found."
    };
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
        businessId
      )
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
      timezone:
        business?.timezone ||
        "Europe/London",
      slots: []
    };
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

  const bindings = [
    businessId,
    date
  ];


  if (excludeAppointmentId) {

    appointmentsQuery += `
      AND id != ?
    `;

    bindings.push(
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
        ...bindings
      )
      .all();


  const duration =
    Number(
      service.duration_minutes
    );


  const interval =
    Number(
      hours
        .booking_interval_minutes ||
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
    (
      appointments.results ||
      []
    ).map(
      (appointment) => {

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
            (
              start.getHours() *
              60
            ) +
            start.getMinutes() -
            bufferBefore,

          end:
            (
              end.getHours() *
              60
            ) +
            end.getMinutes() +
            bufferAfter
        };
      }
    );


  const slots = [];


  for (
    let start =
      openMinutes;

    start + duration <=
      closeMinutes;

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
        minutesToTime(
          start
        )
      );
    }
  }


  return {
    service,
    timezone:
      business?.timezone ||
      "Europe/London",
    booking_interval_minutes:
      interval,
    slots
  };
}


async function getAppointment(
  env,
  businessId,
  appointmentId
) {

  return await env.DB
    .prepare(`
      SELECT
        a.id,
        a.business_id,
        a.customer_id,
        a.service_id,
        a.status,
        a.start_at,
        a.end_at,
        a.price_minor,
        a.deposit_due_minor,
        a.booking_source,
        a.customer_notes,
        a.internal_notes,
        a.created_at,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,
        s.duration_minutes

      FROM appointments a

      JOIN customers c
        ON c.id =
           a.customer_id

      JOIN services s
        ON s.id =
           a.service_id

      WHERE
        a.id = ?
        AND a.business_id = ?

      LIMIT 1
    `)
    .bind(
      appointmentId,
      businessId
    )
    .first();
}


async function findOrCreateCustomer({
  env,
  businessId,
  customerId,
  firstName,
  lastName,
  email,
  phone
}) {

  if (customerId) {

    const existing =
      await env.DB
        .prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone

          FROM customers

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `)
        .bind(
          customerId,
          businessId
        )
        .first();


    if (!existing) {

      return {
        error:
          "Selected customer was not found."
      };
    }


    return {
      customer:
        existing
    };
  }


  let existing = null;


  if (email) {

    existing =
      await env.DB
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
            AND lower(email) =
                lower(?)

          LIMIT 1
        `)
        .bind(
          businessId,
          email
        )
        .first();
  }


  if (
    !existing &&
    phone
  ) {

    existing =
      await env.DB
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
            AND phone = ?

          LIMIT 1
        `)
        .bind(
          businessId,
          phone
        )
        .first();
  }


  if (existing) {

    return {
      customer:
        existing
    };
  }


  const newCustomerId =
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
        phone
      )

      VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `)
    .bind(
      newCustomerId,
      businessId,
      firstName,
      lastName,
      email || null,
      phone || null
    )
    .run();


  return {
    customer: {
      id:
        newCustomerId,
      first_name:
        firstName,
      last_name:
        lastName,
      email:
        email || null,
      phone:
        phone || null
    }
  };
}


/* =======================================================
   GET bookings or customer search
   ======================================================= */

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
      new URL(
        request.url
      );


    const customerSearch =
      String(
        url.searchParams.get(
          "customer_search"
        ) ||
        ""
      ).trim();


    if (customerSearch) {

      const like =
        `%${customerSearch}%`;


      const customers =
        await env.DB
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
              AND (
                first_name LIKE ?
                OR last_name LIKE ?
                OR email LIKE ?
                OR phone LIKE ?
                OR (
                  first_name || ' ' ||
                  last_name
                ) LIKE ?
              )

            ORDER BY
              last_name,
              first_name

            LIMIT 8
          `)
          .bind(
            user.business_id,
            like,
            like,
            like,
            like,
            like
          )
          .all();


      return Response.json({
        ok: true,
        customers:
          customers.results ||
          []
      });
    }


    const bookings =
      await env.DB
        .prepare(`
          SELECT
            a.id,
            a.start_at,
            a.end_at,
            a.status,
            a.price_minor,
            a.deposit_due_minor,
            a.booking_source,
            a.customer_notes AS notes,
            a.internal_notes,
            a.created_at,

            c.id AS customer_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,

            s.id AS service_id,
            s.name AS service_name,
            s.duration_minutes

          FROM appointments a

          JOIN customers c
            ON c.id =
               a.customer_id

          JOIN services s
            ON s.id =
               a.service_id

          WHERE
            a.business_id = ?

          ORDER BY
            CASE
              WHEN
                a.status != 'cancelled'
                AND datetime(a.start_at)
                    >= datetime('now')
              THEN 0
              ELSE 1
            END,
            datetime(a.start_at) ASC
        `)
        .bind(
          user.business_id
        )
        .all();


    return Response.json({
      ok: true,
      bookings:
        bookings.results ||
        []
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


/* =======================================================
   POST booking
   ======================================================= */

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
        body.service_id ||
        ""
      ).trim();

    const date =
      String(
        body.date ||
        ""
      ).trim();

    const time =
      String(
        body.time ||
        ""
      ).trim();

    const customerId =
      String(
        body.customer_id ||
        ""
      ).trim();

    const firstName =
      String(
        body.first_name ||
        ""
      ).trim();

    const lastName =
      String(
        body.last_name ||
        ""
      ).trim();

    const email =
      String(
        body.email ||
        ""
      ).trim();

    const phone =
      String(
        body.phone ||
        ""
      ).trim();

    const notes =
      String(
        body.notes ||
        ""
      ).trim();


    if (!serviceId) {

      return badRequest(
        "Service is required."
      );
    }


    if (!isValidDate(date)) {

      return badRequest(
        "A valid date is required."
      );
    }


    if (!isValidTime(time)) {

      return badRequest(
        "A valid time is required."
      );
    }


    if (!firstName) {

      return badRequest(
        "First name is required."
      );
    }


    if (!lastName) {

      return badRequest(
        "Last name is required."
      );
    }


    if (
      !email &&
      !phone
    ) {

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
      !availability
        .slots
        .includes(time)
    ) {

      return conflict(
        "That time is no longer available."
      );
    }


    const customerResult =
      await findOrCreateCustomer({
        env,
        businessId:
          user.business_id,
        customerId:
          customerId || null,
        firstName,
        lastName,
        email,
        phone
      });


    if (customerResult.error) {

      return badRequest(
        customerResult.error
      );
    }


    const customer =
      customerResult.customer;


    const appointmentId =
      `apt_${
        crypto.randomUUID()
      }`;


    const startAt =
      `${date}T${time}:00`;


    const endAt =
      addMinutesToDateTime(
        date,
        time,
        Number(
          availability
            .service
            .duration_minutes
        )
      );


    const priceMinor =
      Number(
        availability
          .service
          .price_minor ||
        0
      );


    const depositDueMinor =
      availability
        .service
        .payment_timing ===
          "online_deposit"
        ? Number(
            availability
              .service
              .deposit_minor ||
            0
          )
        : 0;


    await env.DB
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

        VALUES (
          ?, ?, ?, ?,
          'confirmed',
          ?, ?, ?, ?,
          'admin',
          ?
        )
      `)
      .bind(
        appointmentId,
        user.business_id,
        customer.id,
        serviceId,
        startAt,
        endAt,
        priceMinor,
        depositDueMinor,
        notes || null
      )
      .run();


    return Response.json({
      ok: true,
      booking: {
        id:
          appointmentId,
        customer_id:
          customer.id,
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


/* =======================================================
   PUT booking / status action
   ======================================================= */

export async function onRequestPut({
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


    const appointmentId =
      String(
        body.id ||
        ""
      ).trim();


    if (!appointmentId) {

      return badRequest(
        "Booking id is required."
      );
    }


    const existing =
      await getAppointment(
        env,
        user.business_id,
        appointmentId
      );


    if (!existing) {

      return notFound(
        "Booking not found."
      );
    }


    const action =
      String(
        body.action ||
        "update"
      ).trim();


    if (
      action ===
      "complete"
    ) {

      if (
        existing.status ===
        "cancelled"
      ) {

        return conflict(
          "A cancelled booking cannot be completed."
        );
      }


      if (
        existing.status ===
        "completed"
      ) {

        return Response.json({
          ok: true
        });
      }


      await env.DB
        .prepare(`
          UPDATE appointments

          SET
            status = 'completed',
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          appointmentId,
          user.business_id
        )
        .run();


      return Response.json({
        ok: true
      });
    }


    if (
      action ===
      "cancel"
    ) {

      if (
        existing.status ===
        "completed"
      ) {

        return conflict(
          "A completed booking cannot be cancelled."
        );
      }


      const reason =
        String(
          body.reason ||
          ""
        ).trim();


      await env.DB
        .prepare(`
          UPDATE appointments

          SET
            status = 'cancelled',
            cancelled_at =
              CURRENT_TIMESTAMP,
            cancellation_reason = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          reason || null,
          appointmentId,
          user.business_id
        )
        .run();


      await sendAppointmentCommunication({
        env,
        businessId:
          user.business_id,
        appointmentId,
        type:
          "cancellation_confirmation",
        uniqueKey:
          `cancellation_confirmation:${appointmentId}:${Date.now()}`,
        baseUrl:
          new URL(request.url).origin
      });


      return Response.json({
        ok: true
      });
    }


    if (
      action !==
      "update"
    ) {

      return badRequest(
        "Invalid booking action."
      );
    }


    if (
      existing.status ===
      "cancelled"
    ) {

      return conflict(
        "A cancelled booking cannot be edited."
      );
    }


    if (
      existing.status ===
      "completed"
    ) {

      return conflict(
        "A completed booking cannot be edited."
      );
    }


    const serviceId =
      String(
        body.service_id ||
        ""
      ).trim();

    const date =
      String(
        body.date ||
        ""
      ).trim();

    const time =
      String(
        body.time ||
        ""
      ).trim();

    const firstName =
      String(
        body.first_name ||
        ""
      ).trim();

    const lastName =
      String(
        body.last_name ||
        ""
      ).trim();

    const email =
      String(
        body.email ||
        ""
      ).trim();

    const phone =
      String(
        body.phone ||
        ""
      ).trim();

    const notes =
      String(
        body.notes ||
        ""
      ).trim();


    if (
      !serviceId ||
      !isValidDate(date) ||
      !isValidTime(time)
    ) {

      return badRequest(
        "Service, date and time are required."
      );
    }


    if (
      !firstName ||
      !lastName
    ) {

      return badRequest(
        "First and last name are required."
      );
    }


    if (
      !email &&
      !phone
    ) {

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
        date,
        excludeAppointmentId:
          appointmentId
      });


    if (availability.error) {

      return badRequest(
        availability.error
      );
    }


    if (
      !availability
        .slots
        .includes(time)
    ) {

      return conflict(
        "That time is no longer available."
      );
    }


    const startAt =
      `${date}T${time}:00`;


    const endAt =
      addMinutesToDateTime(
        date,
        time,
        Number(
          availability
            .service
            .duration_minutes
        )
      );


    const priceMinor =
      Number(
        availability
          .service
          .price_minor ||
        0
      );


    const depositDueMinor =
      availability
        .service
        .payment_timing ===
          "online_deposit"
        ? Number(
            availability
              .service
              .deposit_minor ||
            0
          )
        : 0;


    await env.DB.batch([
      env.DB
        .prepare(`
          UPDATE customers

          SET
            first_name = ?,
            last_name = ?,
            email = ?,
            phone = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          firstName,
          lastName,
          email || null,
          phone || null,
          existing.customer_id,
          user.business_id
        ),

      env.DB
        .prepare(`
          UPDATE appointments

          SET
            service_id = ?,
            start_at = ?,
            end_at = ?,
            price_minor = ?,
            deposit_due_minor = ?,
            customer_notes = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          serviceId,
          startAt,
          endAt,
          priceMinor,
          depositDueMinor,
          notes || null,
          appointmentId,
          user.business_id
        )
    ]);


    const appointmentChanged =
      String(
        existing.start_at ||
        ""
      ) !== startAt ||
      String(
        existing.service_id ||
        ""
      ) !== serviceId;


    if (appointmentChanged) {
      await sendAppointmentCommunication({
        env,
        businessId:
          user.business_id,
        appointmentId,
        type:
          "reschedule_confirmation",
        uniqueKey:
          `reschedule_confirmation:${appointmentId}:${startAt}:${serviceId}`,
        baseUrl:
          new URL(request.url).origin
      });
    }


    return Response.json({
      ok: true,
      booking: {
        id:
          appointmentId,
        service_id:
          serviceId,
        start_at:
          startAt,
        end_at:
          endAt,
        status:
          existing.status
      }
    });


  } catch (error) {

    console.error(
      "Booking update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to update booking."
      },
      {
        status: 500
      }
    );
  }
}
