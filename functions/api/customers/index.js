

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
    await hashSessionToken(
      token
    );


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
   GET list / detail
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


    const id =
      String(
        url.searchParams.get(
          "id"
        ) ||
        ""
      ).trim();


    if (id) {

      const customer =
        await env.DB
          .prepare(`
            SELECT
              c.id,
              c.first_name,
              c.last_name,
              c.email,
              c.phone,
              c.notes,
              c.marketing_consent,
              c.created_at,
              c.updated_at,

              (
                SELECT COUNT(*)

                FROM appointments a

                WHERE
                  a.customer_id = c.id
                  AND a.business_id = c.business_id
                  AND a.status = 'completed'
              ) AS visit_count,

              (
                SELECT COUNT(*)

                FROM appointments a

                WHERE
                  a.customer_id = c.id
                  AND a.business_id = c.business_id
                  AND a.status != 'cancelled'
                  AND datetime(a.start_at)
                      >= datetime('now')
              ) AS upcoming_count,

              (
                SELECT COALESCE(
                  SUM(p.amount_minor),
                  0
                )

                FROM payments p

                WHERE
                  p.customer_id = c.id
                  AND p.business_id = c.business_id
                  AND p.status = 'paid'
                  AND p.payment_type != 'refund'
              ) AS total_paid_minor

            FROM customers c

            WHERE
              c.id = ?
              AND c.business_id = ?

            LIMIT 1
          `)
          .bind(
            id,
            user.business_id
          )
          .first();


      if (!customer) {

        return notFound(
          "Customer not found."
        );
      }


      const upcoming =
        await env.DB
          .prepare(`
            SELECT
              a.id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,
              a.booking_kind,
              s.id AS service_id,
              s.name AS service_name,

              cp.id AS customer_package_id,
              cp.name_snapshot AS package_name,
              cp.sessions_total AS package_sessions_total

            FROM appointments a

            JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN customer_package_appointments cpa
              ON cpa.appointment_id =
                 a.id

            LEFT JOIN customer_packages cp
              ON cp.id =
                 cpa.customer_package_id
              AND cp.business_id =
                  a.business_id

            WHERE
              a.customer_id = ?
              AND a.business_id = ?
              AND a.status IN (
                'pending',
                'confirmed'
              )
              AND datetime(a.start_at)
                  >= datetime('now')

            ORDER BY
              datetime(a.start_at) ASC

            LIMIT 20
          `)
          .bind(
            id,
            user.business_id
          )
          .all();


      const history =
        await env.DB
          .prepare(`
            SELECT
              a.id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,
              a.booking_kind,
              s.id AS service_id,
              s.name AS service_name,

              cp.id AS customer_package_id,
              cp.name_snapshot AS package_name,
              cp.sessions_total AS package_sessions_total

            FROM appointments a

            JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN customer_package_appointments cpa
              ON cpa.appointment_id =
                 a.id

            LEFT JOIN customer_packages cp
              ON cp.id =
                 cpa.customer_package_id
              AND cp.business_id =
                  a.business_id

            WHERE
              a.customer_id = ?
              AND a.business_id = ?
              AND (
                a.status IN (
                  'completed',
                  'cancelled',
                  'no_show'
                )
                OR (
                  a.status IN (
                    'pending',
                    'confirmed'
                  )
                  AND datetime(a.start_at)
                      < datetime('now')
                )
              )

            ORDER BY
              datetime(a.start_at) DESC

            LIMIT 50
          `)
          .bind(
            id,
            user.business_id
          )
          .all();


      const [
        clinicalRecords,
        treatmentRecords,
        formRequests,
        photoRows,
        paymentRows
      ] =
        await Promise.all([

          env.DB
            .prepare(`
              SELECT
                cs.id,
                cs.template_id,
                cs.appointment_id,
                cs.status,
                cs.submitted_by,
                cs.submitted_at,
                cs.reviewed_at,

                ct.name AS template_name,
                ct.template_type,
                ct.is_client_sendable,

                a.start_at AS appointment_start_at,
                sv.name AS service_name

              FROM clinical_form_submissions cs

              JOIN clinical_templates ct
                ON ct.id =
                   cs.template_id

              LEFT JOIN appointments a
                ON a.id =
                   cs.appointment_id

              LEFT JOIN services sv
                ON sv.id =
                   a.service_id

              WHERE
                cs.business_id = ?
                AND cs.customer_id = ?

              ORDER BY
                datetime(
                  cs.submitted_at
                ) DESC
            `)
            .bind(
              user.business_id,
              id
            )
            .all(),


          env.DB
            .prepare(`
              SELECT
                tr.id,
                tr.appointment_id,
                tr.service_id,
                tr.status,
                tr.treatment_date,
                tr.practitioner_name,
                tr.treatment_area,
                tr.device_name,
                tr.next_treatment_date,
                tr.created_at,

                s.name AS service_name,
                a.start_at AS appointment_start_at

              FROM treatment_records tr

              LEFT JOIN services s
                ON s.id =
                   tr.service_id

              LEFT JOIN appointments a
                ON a.id =
                   tr.appointment_id

              WHERE
                tr.business_id = ?
                AND tr.customer_id = ?

              ORDER BY
                date(
                  tr.treatment_date
                ) DESC,
                datetime(
                  tr.created_at
                ) DESC
            `)
            .bind(
              user.business_id,
              id
            )
            .all(),


          env.DB
            .prepare(`
              SELECT
                r.id,
                r.template_id,
                r.appointment_id,
                r.status,
                r.created_at,
                r.opened_at,
                r.submitted_at,
                r.email_status,
                r.request_token,

                t.name AS template_name,
                t.template_type,

                a.start_at AS appointment_start_at,
                s.name AS service_name

              FROM clinical_form_requests r

              JOIN clinical_templates t
                ON t.id =
                   r.template_id

              LEFT JOIN appointments a
                ON a.id =
                   r.appointment_id

              LEFT JOIN services s
                ON s.id =
                   a.service_id

              WHERE
                r.business_id = ?
                AND r.customer_id = ?

              ORDER BY
                datetime(
                  r.created_at
                ) DESC
            `)
            .bind(
              user.business_id,
              id
            )
            .all(),


          env.DB
            .prepare(`
              SELECT
                p.id,
                p.appointment_id,
                p.service_id,
                p.treatment_record_id,
                p.photo_type,
                p.original_name,
                p.mime_type,
                p.size_bytes,
                p.taken_at,
                p.notes,
                p.created_at,

                s.name AS service_name,
                a.start_at AS appointment_start_at

              FROM customer_photos p

              LEFT JOIN services s
                ON s.id =
                   p.service_id

              LEFT JOIN appointments a
                ON a.id =
                   p.appointment_id

              WHERE
                p.business_id = ?
                AND p.customer_id = ?

              ORDER BY
                COALESCE(
                  p.taken_at,
                  p.created_at
                ) DESC
            `)
            .bind(
              user.business_id,
              id
            )
            .all(),


          env.DB
            .prepare(`
              SELECT
                p.id,
                p.appointment_id,
                p.payment_type,
                p.amount_minor,
                p.currency,
                p.status,
                p.created_at,

                s.name AS service_name,
                s.requires_consultation AS service_requires_consultation,
                a.booking_kind AS appointment_booking_kind,
                a.start_at AS appointment_start_at,

                cp.id AS customer_package_id,
                cp.name_snapshot AS package_name,
                cp.service_id AS package_service_id,
                ps.name AS package_service_name

              FROM payments p

              LEFT JOIN appointments a
                ON a.id =
                   p.appointment_id

              LEFT JOIN services s
                ON s.id =
                   a.service_id

              LEFT JOIN customer_package_payments cpp
                ON cpp.payment_id =
                   p.id

              LEFT JOIN customer_packages cp
                ON cp.id =
                   cpp.customer_package_id

              LEFT JOIN services ps
                ON ps.id =
                   cp.service_id

              WHERE
                p.business_id = ?
                AND p.customer_id = ?

              ORDER BY
                datetime(
                  p.created_at
                ) DESC
            `)
            .bind(
              user.business_id,
              id
            )
            .all()
        ]);


      const photoList =
        (
          photoRows.results ||
          []
        ).map(
          (photo) => ({
            ...photo,
            content_url:
              `/api/customer-photos?photo_id=${encodeURIComponent(
                photo.id
              )}&content=1`
          })
        );


      const clinicalList =
        clinicalRecords.results ||
        [];


      const treatmentList =
        treatmentRecords.results ||
        [];


      const requestList =
        formRequests.results ||
        [];


      const paymentList =
        paymentRows.results ||
        [];


      const communicationRows =
        await env.DB
          .prepare(`
            SELECT
              cc.id,
              cc.communication_type,
              cc.recipient,
              cc.subject,
              cc.status,
              cc.sent_at,
              cc.created_at,
              cc.error_details,

              a.start_at AS appointment_start_at,
              s.name AS service_name,
              cp.name_snapshot AS package_name,
              ct.name AS form_name

            FROM customer_communications cc

            LEFT JOIN appointments a
              ON a.id =
                 cc.appointment_id

            LEFT JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN customer_packages cp
              ON cp.id =
                 cc.customer_package_id

            LEFT JOIN clinical_form_requests cfr
              ON cfr.id =
                 cc.form_request_id

            LEFT JOIN clinical_templates ct
              ON ct.id =
                 cfr.template_id

            WHERE
              cc.business_id = ?
              AND cc.customer_id = ?

            ORDER BY
              datetime(
                COALESCE(
                  cc.sent_at,
                  cc.created_at
                )
              ) DESC

            LIMIT 50
          `)
          .bind(
            user.business_id,
            id
          )
          .all();


      const communicationList =
        communicationRows.results ||
        [];


      const packageRows =
        await env.DB
          .prepare(`
            SELECT
              cp.id,
              cp.name_snapshot,
              cp.service_id,
              cp.sessions_total,
              cp.price_minor,
              cp.status,
              cp.starts_on,
              cp.expires_on,
              cp.created_at,

              s.name AS service_name,

              (
                SELECT COUNT(*)
                FROM customer_package_appointments cpa
                JOIN appointments a
                  ON a.id =
                     cpa.appointment_id
                WHERE
                  cpa.customer_package_id =
                    cp.id
                  AND a.status =
                    'completed'
              ) AS sessions_completed,

              (
                SELECT COUNT(*)
                FROM customer_package_appointments cpa
                JOIN appointments a
                  ON a.id =
                     cpa.appointment_id
                WHERE
                  cpa.customer_package_id =
                    cp.id
                  AND a.status IN (
                    'confirmed',
                    'pending'
                  )
              ) AS sessions_booked,

              (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN p.payment_type = 'refund' AND p.status = 'paid'
                        THEN -ABS(p.amount_minor)
                      WHEN p.payment_type != 'refund'
                           AND p.status IN ('paid', 'partially_refunded', 'refunded')
                        THEN ABS(p.amount_minor)
                      ELSE 0
                    END
                  ),
                  0
                )
                FROM customer_package_payments cpp
                JOIN payments p
                  ON p.id =
                     cpp.payment_id
                WHERE
                  cpp.customer_package_id =
                    cp.id
              ) AS paid_minor,

              (
                SELECT COALESCE(
                  SUM(ps.consultation_credit_minor),
                  0
                )
                FROM package_sales ps
                WHERE
                  ps.business_id = cp.business_id
                  AND ps.customer_package_id = cp.id
                  AND ps.status = 'paid'
              ) AS consultation_credit_minor

            FROM customer_packages cp

            JOIN services s
              ON s.id =
                 cp.service_id

            WHERE
              cp.business_id = ?
              AND cp.customer_id = ?

            ORDER BY
              CASE cp.status
                WHEN 'active' THEN 0
                WHEN 'completed' THEN 1
                ELSE 2
              END,
              datetime(cp.created_at) DESC
          `)
          .bind(
            user.business_id,
            id
          )
          .all();


      const packageSessionRows =
        await env.DB
          .prepare(`
            SELECT
              cpa.customer_package_id,

              a.id AS appointment_id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,

              s.name AS service_name

            FROM customer_package_appointments cpa

            JOIN customer_packages cp
              ON cp.id =
                 cpa.customer_package_id

            JOIN appointments a
              ON a.id =
                 cpa.appointment_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              cp.business_id = ?
              AND cp.customer_id = ?

            ORDER BY
              datetime(a.start_at) ASC
          `)
          .bind(
            user.business_id,
            id
          )
          .all();


      const packageList =
        (
          packageRows.results ||
          []
        ).map(
          (item) => ({
            ...item,
            sessions_completed:
              Number(
                item.sessions_completed ||
                0
              ),
            sessions_booked:
              Number(
                item.sessions_booked ||
                0
              ),
            sessions_available_to_book:
              Math.max(
                Number(
                  item.sessions_total ||
                  0
                ) -
                Number(
                  item.sessions_completed ||
                  0
                ) -
                Number(
                  item.sessions_booked ||
                  0
                ),
                0
              ),
            paid_minor:
              Number(
                item.paid_minor ||
                0
              ),
            consultation_credit_minor:
              Number(
                item.consultation_credit_minor ||
                0
              ),
            credited_paid_minor:
              Number(
                item.paid_minor ||
                0
              ) +
              Number(
                item.consultation_credit_minor ||
                0
              ),
            outstanding_minor:
              Math.max(
                Number(
                  item.price_minor ||
                  0
                ) -
                Number(
                  item.paid_minor ||
                  0
                ) -
                Number(
                  item.consultation_credit_minor ||
                  0
                ),
                0
              )
          })
        );


      const packageSessionsById =
        {};


      for (
        const session of
        packageSessionRows.results ||
        []
      ) {
        if (
          !packageSessionsById[
            session.customer_package_id
          ]
        ) {
          packageSessionsById[
            session.customer_package_id
          ] = [];
        }

        packageSessionsById[
          session.customer_package_id
        ].push(session);
      }


      for (
        const item of
        packageList
      ) {
        const sessions =
          packageSessionsById[
            item.id
          ] ||
          [];

        item.sessions =
          sessions.map(
            (session, index) => ({
              ...session,
              session_number:
                index + 1
            })
          );
      }


      const timeline = [];


      for (
        const payment of
        paymentList.filter(
          (item) =>
            item.status !==
            "failed"
        )
      ) {
        timeline.push({
          id:
            `payment:${payment.id}`,
          event_type:
            "payment",
          event_date:
            payment.created_at,
          title:
            payment.customer_package_id
              ? `Package payment · ${
                  payment.package_name ||
                  "Package"
                }`
              : (
                  payment.appointment_booking_kind ===
                    "consultation" &&
                  payment.service_name
                    ? `Consultation · ${payment.service_name}`
                    : (
                        payment.service_name ||
                        "Customer payment"
                      )
                ),
          subtitle:
            payment.status,
          amount_minor:
            Number(
              payment.amount_minor ||
              0
            ),
          payment_type:
            payment.payment_type,
          appointment_booking_kind:
            payment.appointment_booking_kind ||
            null,
          appointment_id:
            payment.appointment_id ||
            null,
          customer_package_id:
            payment.customer_package_id ||
            null,
          service_name:
            payment.package_service_name ||
            payment.service_name ||
            null
        });
      }


      for (
        const appointment of [
          ...(upcoming.results || []),
          ...(history.results || [])
        ]
      ) {
        let packageSessionNumber =
          null;


        if (
          appointment.customer_package_id
        ) {
          const packageItem =
            packageList.find(
              (item) =>
                item.id ===
                appointment.customer_package_id
            );

          const packageSession =
            packageItem
              ?.sessions
              ?.find(
                (session) =>
                  session.appointment_id ===
                  appointment.id
              );

          packageSessionNumber =
            packageSession
              ?.session_number ||
            null;
        }


        timeline.push({
          id:
            `appointment:${appointment.id}`,
          event_type:
            appointment.customer_package_id
              ? "package_session"
              : "appointment",
          event_date:
            appointment.start_at,
          title:
            appointment.customer_package_id
              ? `${
                  appointment.package_name ||
                  appointment.service_name ||
                  "Package"
                }${
                  packageSessionNumber
                    ? ` · Session ${packageSessionNumber}/${appointment.package_sessions_total}`
                    : ""
                }`
              : (
                  appointment.booking_kind ===
                    "consultation"
                    ? `Consultation · ${
                        appointment.service_name ||
                        "Appointment"
                      }`
                    : (
                        appointment.service_name ||
                        "Appointment"
                      )
                ),
          subtitle:
            appointment.status,
          booking_kind:
            appointment.booking_kind ||
            "service",
          appointment_id:
            appointment.id,
          customer_package_id:
            appointment.customer_package_id ||
            null,
          service_name:
            appointment.service_name ||
            null,
          package_name:
            appointment.package_name ||
            null,
          session_number:
            packageSessionNumber
        });
      }


      for (
        const request of
        requestList.filter(
          (item) =>
            [
              "created",
              "opened"
            ].includes(
              item.status
            )
        )
      ) {
        timeline.push({
          id:
            `form_request:${request.id}`,
          event_type:
            "form_request",
          event_date:
            request.opened_at ||
            request.created_at,
          title:
            request.template_name ||
            "Client form",
          subtitle:
            request.status ===
              "opened"
              ? "opened"
              : "outstanding",
          appointment_id:
            request.appointment_id ||
            null,
          service_name:
            request.service_name ||
            null
        });
      }


      for (
        const record of
        clinicalList
      ) {
        timeline.push({
          id:
            `clinical:${record.id}`,
          event_type:
            record.template_type ===
              "patch_test"
              ? "patch_test"
              : (
                  record.is_client_sendable ===
                    1
                    ? "client_form"
                    : "clinical_record"
                ),
          event_date:
            record.submitted_at,
          title:
            record.template_name ||
            "Clinical form",
          subtitle:
            record.status,
          record_id:
            record.id,
          appointment_id:
            record.appointment_id ||
            null,
          service_name:
            record.service_name ||
            null
        });
      }


      for (
        const record of
        treatmentList
      ) {
        timeline.push({
          id:
            `treatment:${record.id}`,
          event_type:
            "treatment_record",
          event_date:
            record.treatment_date ||
            record.created_at,
          title:
            record.service_name
              ? `${record.service_name} treatment`
              : "Treatment record",
          subtitle:
            record.status,
          record_id:
            record.id,
          appointment_id:
            record.appointment_id ||
            null,
          service_name:
            record.service_name ||
            null
        });
      }


      for (
        const photo of
        photoList
      ) {
        timeline.push({
          id:
            `photo:${photo.id}`,
          event_type:
            "photo",
          event_date:
            photo.taken_at ||
            photo.created_at,
          title:
            `${
              photo.photo_type
                .replaceAll(
                  "_",
                  " "
                )
            } photo`,
          subtitle:
            photo.service_name ||
            "Customer photo",
          photo_id:
            photo.id,
          content_url:
            photo.content_url,
          appointment_id:
            photo.appointment_id ||
            null,
          service_name:
            photo.service_name ||
            null
        });
      }


      for (
        const item of
        packageList
      ) {
        timeline.push({
          id:
            `package:${item.id}`,
          event_type:
            "package",
          event_date:
            item.starts_on ||
            item.created_at,
          title:
            item.name_snapshot,
          subtitle:
            item.status,
          service_name:
            item.service_name ||
            null
        });
      }


      timeline.sort(
        (a, b) =>
          String(
            b.event_date ||
            ""
          ).localeCompare(
            String(
              a.event_date ||
              ""
            )
          )
      );


      const appointmentCreditRows =
        await env.DB
          .prepare(`
            SELECT
              id AS appointment_id,
              consultation_credit_minor
            FROM appointments
            WHERE
              business_id = ?
              AND customer_id = ?
              AND consultation_credit_minor > 0
          `)
          .bind(
            user.business_id,
            id
          )
          .all();

      const appointmentCreditById =
        Object.fromEntries(
          (appointmentCreditRows.results || []).map(
            row => [
              row.appointment_id,
              Number(row.consultation_credit_minor || 0)
            ]
          )
        );


      const packageOutstandingMinor =
        packageList.reduce(
          (total, item) =>
            total +
            Number(
              item.status ===
                "active"
                ? item.outstanding_minor ||
                  0
                : 0
            ),
          0
        );


      const appointmentOutstandingMinor =
        [
          ...(upcoming.results || []),
          ...(history.results || [])
        ]
          .filter(
            (appointment) =>
              !appointment.customer_package_id &&
              appointment.status !==
                "cancelled"
          )
          .reduce(
            (total, appointment) => {
              const appointmentPayments =
                paymentList.filter(
                  (payment) =>
                    payment.appointment_id ===
                    appointment.id
                );

              const netPaid =
                appointmentPayments.reduce(
                  (sum, payment) => {
                    const amount =
                      Math.abs(
                        Number(
                          payment.amount_minor ||
                          0
                        )
                      );

                    if (
                      payment.payment_type ===
                        "refund" &&
                      payment.status ===
                        "paid"
                    ) {
                      return sum - amount;
                    }

                    if (
                      payment.payment_type !==
                        "refund" &&
                      [
                        "paid",
                        "partially_refunded",
                        "refunded"
                      ].includes(
                        payment.status
                      )
                    ) {
                      return sum + amount;
                    }

                    return sum;
                  },
                  0
                );

              return total +
                Math.max(
                  Number(
                    appointment.price_minor ||
                    0
                  ) -
                  netPaid -
                  Number(
                    appointmentCreditById[appointment.id] ||
                    0
                  ),
                  0
                );
            },
            0
          );


      return Response.json({
        ok: true,

        customer: {
          ...customer,

          upcoming_bookings:
            upcoming.results ||
            [],

          booking_history:
            history.results ||
            [],

          clinical_records:
            clinicalList,

          treatment_records:
            treatmentList,

          form_requests:
            requestList,

          photos:
            photoList,

          payments:
            paymentList,

          communications:
            communicationList,

          packages:
            packageList,

          financial_summary: {
            total_paid_minor:
              Number(
                customer.total_paid_minor ||
                0
              ),
            package_outstanding_minor:
              packageOutstandingMinor,
            appointment_outstanding_minor:
              appointmentOutstandingMinor,
            total_outstanding_minor:
              packageOutstandingMinor +
              appointmentOutstandingMinor
          },

          timeline,

          record_counts: {
            clinical:
              clinicalList.length,
            treatments:
              treatmentList.length,
            photos:
              photoList.length,
            forms_outstanding:
              requestList.filter(
                (request) =>
                  [
                    "created",
                    "opened"
                  ].includes(
                    request.status
                  )
              ).length
          }
        }
      });
    }


    const customers =
      await env.DB
        .prepare(`
          SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.notes,
            c.marketing_consent,
            c.created_at,
            c.updated_at,

            (
              SELECT COUNT(*)

              FROM appointments a

              WHERE
                a.customer_id = c.id
                AND a.business_id = c.business_id
                AND a.status = 'completed'
            ) AS visit_count,

            (
              SELECT COALESCE(
                SUM(p.amount_minor),
                0
              )

              FROM payments p

              WHERE
                p.customer_id = c.id
                AND p.business_id = c.business_id
                AND p.status = 'paid'
                AND p.payment_type != 'refund'
            ) AS total_paid_minor

          FROM customers c

          WHERE
            c.business_id = ?

          ORDER BY
            c.last_name COLLATE NOCASE,
            c.first_name COLLATE NOCASE
        `)
        .bind(
          user.business_id
        )
        .all();


    return Response.json({
      ok: true,

      customers:
        customers.results ||
        []
    });


  } catch (error) {

    console.error(
      "Customers GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load customers."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   POST customer
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

    const marketingConsent =
      body.marketing_consent === 1
        ? 1
        : 0;


    if (
      !firstName ||
      !lastName
    ) {

      return badRequest(
        "First and last name are required."
      );
    }


    if (email) {

      const duplicate =
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


      if (duplicate) {

        return Response.json(
          {
            ok: false,
            error:
              "A customer with this email address already exists.",
            customer_id:
              duplicate.id
          },
          {
            status: 409
          }
        );
      }
    }


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
          notes,
          marketing_consent
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        id,
        user.business_id,
        firstName,
        lastName,
        email || null,
        phone || null,
        notes || null,
        marketingConsent
      )
      .run();


    return Response.json({
      ok: true,
      customer: {
        id
      }
    });


  } catch (error) {

    console.error(
      "Customer creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to create customer."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   PUT customer
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

    const marketingConsent =
      body.marketing_consent === 1
        ? 1
        : 0;


    if (!id) {

      return badRequest(
        "Customer id is required."
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


    const existing =
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
          id,
          user.business_id
        )
        .first();


    if (!existing) {

      return notFound(
        "Customer not found."
      );
    }


    if (email) {

      const duplicate =
        await env.DB
          .prepare(`
            SELECT id

            FROM customers

            WHERE
              business_id = ?
              AND lower(email) =
                  lower(?)
              AND id != ?

            LIMIT 1
          `)
          .bind(
            user.business_id,
            email,
            id
          )
          .first();


      if (duplicate) {

        return Response.json(
          {
            ok: false,
            error:
              "Another customer already uses this email address."
          },
          {
            status: 409
          }
        );
      }
    }


    await env.DB
      .prepare(`
        UPDATE customers

        SET
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          notes = ?,
          marketing_consent = ?,
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
        notes || null,
        marketingConsent,
        id,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Customer update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to update customer."
      },
      {
        status: 500
      }
    );
  }
}
