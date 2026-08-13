import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";


async function getUserContext(
  request,
  env
) {

  const token =
    readSessionToken(
      request
    );


  if (!token) {
    return null;
  }


  const tokenHash =
    await hashSessionToken(
      token
    );


  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(
      tokenHash
    )
    .first();
}


function unauthorized() {

  return Response.json(
    {
      ok: false,
      error:
        "Authentication required."
    },
    {
      status: 401
    }
  );
}


function badRequest(
  message
) {

  return Response.json(
    {
      ok: false,
      error:
        message
    },
    {
      status: 400
    }
  );
}


function notFound(
  message
) {

  return Response.json(
    {
      ok: false,
      error:
        message
    },
    {
      status: 404
    }
  );
}


/* =======================================================
   GET
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


    const [
      recordRows,
      customerRows,
      appointmentRows,
      serviceRows,
      totalRecords,
      monthRecords,
      draftRecords,
      followupRecords
    ] =
      await Promise.all([

        env.DB
          .prepare(`
            SELECT
              tr.id,
              tr.business_id,
              tr.appointment_id,
              tr.customer_id,
              tr.service_id,
              tr.practitioner_user_id,
              tr.status,
              tr.treatment_date,
              tr.practitioner_name,
              tr.treatment_area,
              tr.device_name,
              tr.device_settings,
              tr.treatment_notes,
              tr.client_response,
              tr.client_tolerance,
              tr.aftercare_notes,
              tr.next_session_plan,
              tr.next_treatment_date,
              tr.created_at,
              tr.updated_at,

              c.first_name,
              c.last_name,

              s.name AS service_name

            FROM treatment_records tr

            JOIN customers c
              ON c.id =
                 tr.customer_id

            LEFT JOIN services s
              ON s.id =
                 tr.service_id

            WHERE
              tr.business_id = ?

            ORDER BY
              date(
                tr.treatment_date
              ) DESC,
              datetime(
                tr.created_at
              ) DESC
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              id,
              first_name,
              last_name

            FROM customers

            WHERE
              business_id = ?

            ORDER BY
              last_name COLLATE NOCASE,
              first_name COLLATE NOCASE
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              a.id,
              a.customer_id,
              a.service_id,
              a.start_at,
              a.status,
              a.booking_kind,

              c.first_name,
              c.last_name,

              s.name AS service_name

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status !=
                  'cancelled'
              AND a.booking_kind !=
                  'consultation'

            ORDER BY
              datetime(
                a.start_at
              ) DESC
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              id,
              name

            FROM services

            WHERE
              business_id = ?
              AND is_active = 1

            ORDER BY
              name COLLATE NOCASE
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
          `)
          .bind(
            user.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
              AND strftime(
                '%Y-%m',
                treatment_date
              ) =
              strftime(
                '%Y-%m',
                'now'
              )
          `)
          .bind(
            user.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
              AND status = 'draft'
          `)
          .bind(
            user.business_id
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
              AND next_treatment_date
                  IS NOT NULL
              AND trim(
                next_treatment_date
              ) != ''
          `)
          .bind(
            user.business_id
          )
          .first()
      ]);


    return Response.json({
      ok: true,

      user: {
        id:
          user.user_id,
        name:
          user.user_name
      },

      stats: {
        total_records:
          Number(
            totalRecords?.count ||
            0
          ),

        month_records:
          Number(
            monthRecords?.count ||
            0
          ),

        draft_records:
          Number(
            draftRecords?.count ||
            0
          ),

        followup_records:
          Number(
            followupRecords?.count ||
            0
          )
      },

      records:
        recordRows.results ||
        [],

      customers:
        customerRows.results ||
        [],

      appointments:
        appointmentRows.results ||
        [],

      services:
        serviceRows.results ||
        []
    });


  } catch (error) {

    console.error(
      "Treatment records GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load treatment records."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   POST
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


    const validation =
      await validatePayload({
        body,
        user,
        env
      });


    if (!validation.ok) {

      return badRequest(
        validation.error
      );
    }


    if (
      validation.appointment
    ) {

      const existing =
        await env.DB
          .prepare(`
            SELECT id

            FROM treatment_records

            WHERE
              business_id = ?
              AND appointment_id = ?

            LIMIT 1
          `)
          .bind(
            user.business_id,
            validation.appointment.id
          )
          .first();


      if (existing) {

        return Response.json(
          {
            ok: false,
            error:
              "A treatment record already exists for this appointment.",
            treatment_record_id:
              existing.id
          },
          {
            status: 409
          }
        );
      }
    }


    const id =
      `tr_${
        crypto.randomUUID()
      }`;


    await env.DB
      .prepare(`
        INSERT INTO treatment_records (
          id,
          business_id,
          appointment_id,
          customer_id,
          service_id,
          practitioner_user_id,
          status,
          treatment_date,
          practitioner_name,
          treatment_area,
          device_name,
          device_settings,
          treatment_notes,
          client_response,
          client_tolerance,
          aftercare_notes,
          next_session_plan,
          next_treatment_date
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        id,
        user.business_id,
        validation.appointmentId ||
          null,
        validation.customerId,
        validation.serviceId ||
          null,
        user.user_id,
        validation.status,
        validation.treatmentDate,
        validation.practitionerName,
        validation.treatmentArea ||
          null,
        validation.deviceName ||
          null,
        validation.deviceSettings ||
          null,
        validation.treatmentNotes ||
          null,
        validation.clientResponse ||
          null,
        validation.clientTolerance ||
          null,
        validation.aftercareNotes ||
          null,
        validation.nextSessionPlan ||
          null,
        validation.nextTreatmentDate ||
          null
      )
      .run();


    return Response.json({
      ok: true,
      treatment_record: {
        id
      }
    });


  } catch (error) {

    console.error(
      "Treatment record creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to create treatment record."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   PUT
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


    const id =
      String(
        body.id ||
        ""
      ).trim();


    if (!id) {

      return badRequest(
        "Treatment record id is required."
      );
    }


    const existing =
      await env.DB
        .prepare(`
          SELECT id

          FROM treatment_records

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `)
        .bind(
          id,
          user.business_id
        )
        .first();


    if (!existing) {

      return notFound(
        "Treatment record not found."
      );
    }


    const validation =
      await validatePayload({
        body,
        user,
        env
      });


    if (!validation.ok) {

      return badRequest(
        validation.error
      );
    }


    if (
      validation.appointment
    ) {

      const duplicate =
        await env.DB
          .prepare(`
            SELECT id

            FROM treatment_records

            WHERE
              business_id = ?
              AND appointment_id = ?
              AND id != ?

            LIMIT 1
          `)
          .bind(
            user.business_id,
            validation.appointment.id,
            id
          )
          .first();


      if (duplicate) {

        return Response.json(
          {
            ok: false,
            error:
              "Another treatment record already uses this appointment."
          },
          {
            status: 409
          }
        );
      }
    }


    await env.DB
      .prepare(`
        UPDATE treatment_records

        SET
          appointment_id = ?,
          customer_id = ?,
          service_id = ?,
          practitioner_user_id = ?,
          status = ?,
          treatment_date = ?,
          practitioner_name = ?,
          treatment_area = ?,
          device_name = ?,
          device_settings = ?,
          treatment_notes = ?,
          client_response = ?,
          client_tolerance = ?,
          aftercare_notes = ?,
          next_session_plan = ?,
          next_treatment_date = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        validation.appointmentId ||
          null,
        validation.customerId,
        validation.serviceId ||
          null,
        user.user_id,
        validation.status,
        validation.treatmentDate,
        validation.practitionerName,
        validation.treatmentArea ||
          null,
        validation.deviceName ||
          null,
        validation.deviceSettings ||
          null,
        validation.treatmentNotes ||
          null,
        validation.clientResponse ||
          null,
        validation.clientTolerance ||
          null,
        validation.aftercareNotes ||
          null,
        validation.nextSessionPlan ||
          null,
        validation.nextTreatmentDate ||
          null,
        id,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Treatment record update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to update treatment record."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   Validation
   ======================================================= */

async function validatePayload({
  body,
  user,
  env
}) {

  const customerId =
    String(
      body.customer_id ||
      ""
    ).trim();

  const appointmentId =
    String(
      body.appointment_id ||
      ""
    ).trim();

  const serviceId =
    String(
      body.service_id ||
      ""
    ).trim();

  const treatmentDate =
    String(
      body.treatment_date ||
      ""
    ).trim();

  const practitionerName =
    String(
      body.practitioner_name ||
      ""
    ).trim();

  const status =
    String(
      body.status ||
      "complete"
    ).trim();

  const treatmentArea =
    String(
      body.treatment_area ||
      ""
    ).trim();

  const deviceName =
    String(
      body.device_name ||
      ""
    ).trim();

  const deviceSettings =
    String(
      body.device_settings ||
      ""
    ).trim();

  const treatmentNotes =
    String(
      body.treatment_notes ||
      ""
    ).trim();

  const clientResponse =
    String(
      body.client_response ||
      ""
    ).trim();

  const clientTolerance =
    String(
      body.client_tolerance ||
      ""
    ).trim();

  const aftercareNotes =
    String(
      body.aftercare_notes ||
      ""
    ).trim();

  const nextSessionPlan =
    String(
      body.next_session_plan ||
      ""
    ).trim();

  const nextTreatmentDate =
    String(
      body.next_treatment_date ||
      ""
    ).trim();


  if (
    !customerId ||
    !serviceId ||
    !treatmentDate ||
    !practitionerName
  ) {

    return {
      ok: false,
      error:
        "Customer, service, treatment date and practitioner are required."
    };
  }


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      treatmentDate
    )
  ) {

    return {
      ok: false,
      error:
        "Treatment date is invalid."
    };
  }


  if (
    nextTreatmentDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      nextTreatmentDate
    )
  ) {

    return {
      ok: false,
      error:
        "Next treatment date is invalid."
    };
  }


  if (
    ![
      "draft",
      "complete"
    ].includes(
      status
    )
  ) {

    return {
      ok: false,
      error:
        "Invalid record status."
    };
  }


  const customer =
    await env.DB
      .prepare(`
        SELECT id

        FROM customers

        WHERE
          id = ?
          AND business_id = ?

        LIMIT 1
      `)
      .bind(
        customerId,
        user.business_id
      )
      .first();


  if (!customer) {

    return {
      ok: false,
      error:
        "Customer not found."
    };
  }


  const service =
    await env.DB
      .prepare(`
        SELECT id

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


  if (!service) {

    return {
      ok: false,
      error:
        "Service not found."
    };
  }


  let appointment = null;


  if (appointmentId) {

    appointment =
      await env.DB
        .prepare(`
          SELECT
            id,
            customer_id,
            service_id,
            booking_kind

          FROM appointments

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `)
        .bind(
          appointmentId,
          user.business_id
        )
        .first();


    if (!appointment) {

      return {
        ok: false,
        error:
          "Appointment not found."
      };
    }


    if (
      appointment.customer_id !==
      customerId
    ) {

      return {
        ok: false,
        error:
          "Appointment does not belong to the selected customer."
      };
    }


    if (
      appointment.service_id !==
      serviceId
    ) {

      return {
        ok: false,
        error:
          "Selected service does not match the appointment."
      };
    }


    if (
      appointment.booking_kind ===
      "consultation"
    ) {

      return {
        ok: false,
        error:
          "A treatment record cannot be linked to a consultation appointment."
      };
    }
  }


  return {
    ok: true,
    customerId,
    appointmentId,
    serviceId,
    treatmentDate,
    practitionerName,
    status,
    treatmentArea,
    deviceName,
    deviceSettings,
    treatmentNotes,
    clientResponse,
    clientTolerance,
    aftercareNotes,
    nextSessionPlan,
    nextTreatmentDate,
    appointment
  };
}
