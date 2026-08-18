function createId(prefix = "hrs") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const bookingInterval =
      Number(body.booking_interval_minutes);

    const hours =
      Array.isArray(body.hours)
        ? body.hours
        : [];

    if (
      ![15, 20, 30, 45, 60].includes(
        bookingInterval
      )
    ) {
      return Response.json(
        {
          ok: false,
          error: "Invalid booking interval."
        },
        { status: 400 }
      );
    }

    if (hours.length !== 7) {
      return Response.json(
        {
          ok: false,
          error:
            "Hours must be supplied for all seven days."
        },
        { status: 400 }
      );
    }

    const business =
      await env.DB
        .prepare(`
          SELECT id
          FROM businesses
          LIMIT 1
        `)
        .first();

    if (!business) {
      return Response.json(
        {
          ok: false,
          error:
            "Business setup must be completed first."
        },
        { status: 409 }
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
            error: "Invalid weekday."
          },
          { status: 400 }
        );
      }

      const isOpen =
        day.is_open ? 1 : 0;

      const openTime =
        isOpen
          ? String(day.open_time || "")
          : null;

      const closeTime =
        isOpen
          ? String(day.close_time || "")
          : null;

      if (
        isOpen &&
        (!openTime || !closeTime)
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "Open days require opening and closing times."
          },
          { status: 400 }
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
          { status: 400 }
        );
      }

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
          VALUES (?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(business_id, weekday)
          DO UPDATE SET
            is_open = excluded.is_open,
            open_time = excluded.open_time,
            close_time = excluded.close_time,
            booking_interval_minutes =
              excluded.booking_interval_minutes,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          createId(),
          business.id,
          weekday,
          isOpen,
          openTime,
          closeTime,
          bookingInterval
        )
        .run();
    }

    await env.DB
      .prepare(`
        UPDATE installer_state
        SET
          current_step = 'branding',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `)
      .run();

    return Response.json({
      ok: true,
      next_step: "branding"
    });

  } catch (error) {
    console.error(
      "Hours installer step failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to save business hours."
      },
      { status: 500 }
    );
  }
}
