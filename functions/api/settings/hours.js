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
        AND datetime(s.expires_at)
            > datetime('now')
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


    const hours =
      await env.DB
        .prepare(`
          SELECT
            weekday,
            is_open,
            open_time,
            close_time,
            booking_interval_minutes

          FROM working_hours

          WHERE business_id = ?

          ORDER BY weekday ASC
        `)
        .bind(
          user.business_id
        )
        .all();


    const rows =
      hours.results || [];


    const hoursByDay = {};


    for (const row of rows) {
      hoursByDay[row.weekday] = row;
    }


    const defaults = [];


    for (
      let weekday = 1;
      weekday <= 7;
      weekday++
    ) {

      const row =
        hoursByDay[weekday];


      defaults.push({
        weekday,

        is_open:
          row
            ? row.is_open === 1
            : weekday <= 5,

        open_time:
          row?.open_time ||
          "09:00",

        close_time:
          row?.close_time ||
          "17:00",

        booking_interval_minutes:
          row?.booking_interval_minutes ||
          30
      });
    }


    return Response.json({
      ok: true,

      timezone:
        business?.timezone ||
        "Europe/London",

      booking_buffer_before_minutes:
        Number(
          business
            ?.booking_buffer_before_minutes ||
          0
        ),

      booking_buffer_after_minutes:
        Number(
          business
            ?.booking_buffer_after_minutes ||
          0
        ),

      hours:
        defaults
    });


  } catch (error) {

    console.error(
      "Working hours GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load working hours."
      },
      {
        status: 500
      }
    );
  }
}


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


    const hours =
      Array.isArray(body.hours)
        ? body.hours
        : [];


    const bookingInterval =
      Number(
        body.booking_interval_minutes
      );


    const bufferBefore =
      Number(
        body.booking_buffer_before_minutes
      );


    const bufferAfter =
      Number(
        body.booking_buffer_after_minutes
      );


    const validIntervals = [
      5,
      10,
      15,
      20,
      30,
      45,
      60
    ];


    const validBuffers = [
      0,
      5,
      10,
      15,
      20,
      30,
      45,
      60
    ];


    if (
      hours.length !== 7
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Working hours must be supplied for all seven days."
        },
        {
          status: 400
        }
      );
    }


    if (
      !validIntervals.includes(
        bookingInterval
      )
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid booking interval."
        },
        {
          status: 400
        }
      );
    }


    if (
      !validBuffers.includes(
        bufferBefore
      ) ||
      !validBuffers.includes(
        bufferAfter
      )
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Invalid booking buffer."
        },
        {
          status: 400
        }
      );
    }


    for (const day of hours) {

      const weekday =
        Number(day.weekday);


      if (
        !Number.isInteger(weekday) ||
        weekday < 1 ||
        weekday > 7
      ) {

        return Response.json(
          {
            ok: false,
            error:
              "Invalid weekday."
          },
          {
            status: 400
          }
        );
      }


      const isOpen =
        day.is_open
          ? 1
          : 0;


      const openTime =
        isOpen
          ? String(
              day.open_time || ""
            )
          : null;


      const closeTime =
        isOpen
          ? String(
              day.close_time || ""
            )
          : null;


      if (
        isOpen &&
        (
          !openTime ||
          !closeTime
        )
      ) {

        return Response.json(
          {
            ok: false,
            error:
              "Open days require opening and closing times."
          },
          {
            status: 400
          }
        );
      }


      if (
        isOpen &&
        openTime >= closeTime
      ) {

        return Response.json(
          {
            ok: false,
            error:
              "Closing time must be later than opening time."
          },
          {
            status: 400
          }
        );
      }
    }


    await env.DB
      .prepare(`
        UPDATE businesses

        SET
          booking_buffer_before_minutes = ?,
          booking_buffer_after_minutes = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `)
      .bind(
        bufferBefore,
        bufferAfter,
        user.business_id
      )
      .run();


    for (const day of hours) {

      const weekday =
        Number(day.weekday);

      const isOpen =
        day.is_open
          ? 1
          : 0;

      const openTime =
        isOpen
          ? String(
              day.open_time
            )
          : null;

      const closeTime =
        isOpen
          ? String(
              day.close_time
            )
          : null;


      await env.DB
        .prepare(`
          INSERT INTO working_hours (
            id,
            business_id,
            weekday,
            is_open,
            open_time,
            close_time,
            booking_interval_minutes
          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?
          )

          ON CONFLICT(
            business_id,
            weekday
          )

          DO UPDATE SET
            is_open =
              excluded.is_open,
            open_time =
              excluded.open_time,
            close_time =
              excluded.close_time,
            booking_interval_minutes =
              excluded.booking_interval_minutes,
            updated_at =
              CURRENT_TIMESTAMP
        `)
        .bind(
          `hrs_${crypto.randomUUID()}`,
          user.business_id,
          weekday,
          isOpen,
          openTime,
          closeTime,
          bookingInterval
        )
        .run();
    }


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Working hours update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to save working hours."
      },
      {
        status: 500
      }
    );
  }
}
