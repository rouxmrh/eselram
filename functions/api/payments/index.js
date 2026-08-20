import {
  runServiceFormAutomation
} from "../../../lib/form-automation.js";

import {
  sendPaymentReceipt
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
        u.business_id,
        b.currency

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      JOIN businesses b
        ON b.id =
           u.business_id

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
      paymentRows,
      customerRows,
      appointmentRows,
      packageRows,
      providerRows,
      paidMonth,
      refundMonth
    ] =
      await Promise.all([

        env.DB
          .prepare(`
            SELECT
              p.id,
              p.appointment_id,
              p.customer_id,
              p.provider,
              p.payment_type,
              p.amount_minor,
              p.currency,
              p.status,
              p.provider_reference,
              p.paid_at,
              p.created_at,
              p.updated_at,
              p.payment_method,
              p.notes,

              (
                SELECT cpp.customer_package_id
                FROM customer_package_payments cpp
                WHERE cpp.payment_id = p.id
                LIMIT 1
              ) AS customer_package_id,

              (
                SELECT cp.name_snapshot
                FROM customer_package_payments cpp
                JOIN customer_packages cp
                  ON cp.id = cpp.customer_package_id
                WHERE cpp.payment_id = p.id
                LIMIT 1
              ) AS package_name,

              c.first_name,
              c.last_name,

              a.start_at,
              a.booking_kind AS appointment_booking_kind,
              s.name AS service_name,

              pp.display_name
                AS provider_display_name,

              CASE
                WHEN
                  p.payment_type = 'refund'
                THEN 0

                ELSE
                  MAX(
                    p.amount_minor -
                    COALESCE(
                      (
                        SELECT
                          SUM(r.amount_minor)

                        FROM payments r

                        WHERE
                          r.business_id =
                            p.business_id
                          AND r.payment_type =
                            'refund'
                          AND r.status =
                            'paid'
                          AND (
                            r.provider_reference =
                              'refund:' || p.id
                            OR instr(
                              COALESCE(r.notes, ''),
                              'original_payment=' || p.id
                            ) > 0
                          )
                      ),
                      0
                    ),
                    0
                  )
              END
              AS refundable_minor

            FROM payments p

            LEFT JOIN customers c
              ON c.id =
                 p.customer_id

            LEFT JOIN appointments a
              ON a.id =
                 p.appointment_id

            LEFT JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN payment_providers pp
              ON pp.provider_key =
                 p.provider

            WHERE
              p.business_id = ?
              AND NOT (p.provider = 'none' AND COALESCE(p.payment_method, '') = 'discount')
              AND NOT (
                p.status = 'failed'
                AND EXISTS (
                  SELECT 1
                  FROM package_sales ps_failed
                  WHERE
                    ps_failed.business_id = p.business_id
                    AND ps_failed.payment_id = p.id
                    AND ps_failed.status = 'failed'
                )
              )

            ORDER BY
              datetime(
                COALESCE(
                  p.paid_at,
                  p.created_at
                )
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
              a.start_at,
              a.price_minor,
              a.consultation_credit_minor,
              a.status,

              c.first_name,
              c.last_name,

              s.name AS service_name,

              COALESCE(
                (
                  SELECT
                    SUM(
                      CASE
                        WHEN
                          p.payment_type =
                            'refund'
                        THEN -p.amount_minor
                        ELSE p.amount_minor
                      END
                    )

                  FROM payments p

                  WHERE
                    p.appointment_id =
                      a.id
                    AND p.business_id =
                      a.business_id
                    AND p.status IN (
                      'paid',
                      'partially_refunded',
                      'refunded'
                    )
                ),
                0
              ) AS paid_minor

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

            ORDER BY
              datetime(a.start_at) DESC
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              cp.id,
              cp.customer_id,
              cp.name_snapshot AS package_name,
              cp.price_minor,
              cp.starts_on,
              cp.status,

              c.first_name,
              c.last_name,

              s.name AS service_name,

              COALESCE(
                (
                  SELECT SUM(
                    CASE
                      WHEN p.payment_type = 'refund'
                           AND p.status = 'paid'
                        THEN -ABS(p.amount_minor)
                      WHEN p.payment_type != 'refund'
                           AND p.status IN (
                             'paid',
                             'partially_refunded',
                             'refunded'
                           )
                        THEN ABS(p.amount_minor)
                      ELSE 0
                    END
                  )
                  FROM customer_package_payments cpp
                  JOIN payments p
                    ON p.id = cpp.payment_id
                  WHERE cpp.customer_package_id = cp.id
                ),
                0
              ) AS paid_minor,

              COALESCE(
                (
                  SELECT SUM(
                    ps.consultation_credit_minor
                  )
                  FROM package_sales ps
                  WHERE
                    ps.business_id = cp.business_id
                    AND ps.customer_package_id = cp.id
                    AND ps.status = 'paid'
                ),
                0
              ) AS consultation_credit_minor

            FROM customer_packages cp

            JOIN customers c
              ON c.id = cp.customer_id

            LEFT JOIN services s
              ON s.id = cp.service_id

            WHERE
              cp.business_id = ?
              AND cp.status NOT IN (
                'cancelled',
                'expired'
              )

            ORDER BY
              date(cp.starts_on) DESC,
              datetime(cp.created_at) DESC
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              pp.provider_key,
              pp.display_name,
              pp.provider_type,

              COALESCE(
                bpp.is_enabled,
                CASE
                  WHEN
                    pp.provider_key =
                      'manual'
                  THEN 1
                  ELSE 0
                END
              ) AS is_enabled,

              COALESCE(
                bpp.connection_status,
                'not_connected'
              ) AS connection_status

            FROM payment_providers pp

            LEFT JOIN
              business_payment_providers
              bpp

              ON bpp.provider_key =
                 pp.provider_key
              AND bpp.business_id = ?

            WHERE
              pp.is_available = 1
              AND (
                pp.provider_key =
                  'manual'
                OR bpp.is_enabled = 1
              )

            ORDER BY
              pp.sort_order,
              pp.display_name
          `)
          .bind(
            user.business_id
          )
          .all(),


        env.DB
          .prepare(`
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN
                      payment_type =
                        'refund'
                    THEN -amount_minor
                    ELSE amount_minor
                  END
                ),
                0
              ) AS total

            FROM payments

            WHERE
              business_id = ?
              AND NOT (provider = 'none' AND COALESCE(payment_method, '') = 'discount')
              AND status IN (
                'paid',
                'partially_refunded',
                'refunded'
              )
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
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
              COALESCE(
                SUM(amount_minor),
                0
              ) AS total

            FROM payments

            WHERE
              business_id = ?
              AND payment_type =
                  'refund'
              AND status = 'paid'
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) =
              strftime(
                '%Y-%m',
                'now'
              )
          `)
          .bind(
            user.business_id
          )
          .first()
      ]);


    const appointments =
      (
        appointmentRows.results ||
        []
      ).map(
        (appointment) => {

          const paidMinor =
            Number(
              appointment.paid_minor ||
              0
            );


          const priceMinor =
            Number(
              appointment.price_minor ||
              0
            );

          const consultationCreditMinor =
            Number(
              appointment.consultation_credit_minor ||
              0
            );


          return {
            ...appointment,

            paid_minor:
              paidMinor,

            consultation_credit_minor:
              consultationCreditMinor,

            credited_paid_minor:
              paidMinor +
              consultationCreditMinor,

            balance_minor:
              Math.max(
                priceMinor -
                paidMinor -
                consultationCreditMinor,
                0
              )
          };
        }
      );


    const packageBalances =
      (
        packageRows.results ||
        []
      ).map(
        item => {
          const paidMinor =
            Number(
              item.paid_minor ||
              0
            );

          const consultationCreditMinor =
            Number(
              item.consultation_credit_minor ||
              0
            );

          const priceMinor =
            Number(
              item.price_minor ||
              0
            );

          return {
            ...item,
            outstanding_type:
              "package",
            paid_minor:
              paidMinor,
            consultation_credit_minor:
              consultationCreditMinor,
            balance_minor:
              Math.max(
                priceMinor -
                paidMinor -
                consultationCreditMinor,
                0
              )
          };
        }
      );


    const appointmentOutstanding =
      appointments
        .filter(
          appointment =>
            Number(
              appointment.balance_minor
            ) > 0
        )
        .map(
          appointment => ({
            ...appointment,
            outstanding_type:
              "appointment"
          })
        );


    const packageOutstanding =
      packageBalances.filter(
        item =>
          Number(
            item.balance_minor
          ) > 0
      );


    const outstanding = [
      ...appointmentOutstanding,
      ...packageOutstanding
    ];


    const outstandingMinor =
      outstanding.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.balance_minor ||
            0
          ),
        0
      );


    return Response.json({
      ok: true,

      currency:
        user.currency ||
        "GBP",

      stats: {
        paid_month_minor:
          Number(
            paidMonth?.total ||
            0
          ),

        outstanding_minor:
          outstandingMinor,

        refund_month_minor:
          Number(
            refundMonth?.total ||
            0
          ),

        transaction_count:
          (
            paymentRows.results ||
            []
          ).length
      },

      payments:
        paymentRows.results ||
        [],

      customers:
        customerRows.results ||
        [],

      appointments,

      package_balances:
        packageBalances,

      outstanding,

      providers:
        providerRows.results ||
        []
    });


  } catch (error) {

    console.error(
      "Payments GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load payments."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   POST payment / refund
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


    if (
      body.action ===
      "refund"
    ) {

      return await createRefund({
        body,
        user,
        env
      });
    }


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


    const customerPackageId =
      String(
        body.customer_package_id ||
        ""
      ).trim();

    const provider =
      String(
        body.provider ||
        ""
      ).trim();

    const paymentMethod =
      String(
        body.payment_method ||
        ""
      ).trim();

    const paymentType =
      String(
        body.payment_type ||
        ""
      ).trim();

    const amountMinor =
      Number(
        body.amount_minor
      );

    const providerReference =
      String(
        body.provider_reference ||
        ""
      ).trim();

    const notes =
      String(
        body.notes ||
        ""
      ).trim();


    if (!customerId) {

      return badRequest(
        "Customer is required."
      );
    }


    if (
      !Number.isInteger(
        amountMinor
      ) ||
      amountMinor <= 0
    ) {

      return badRequest(
        "A valid amount is required."
      );
    }


    const allowedTypes = [
      "full",
      "deposit",
      "balance",
      "pay_at_appointment"
    ];


    if (
      !allowedTypes.includes(
        paymentType
      )
    ) {

      return badRequest(
        "Invalid payment type."
      );
    }


    const allowedMethods = [
      "paypal",
      "apple_pay",
      "google_pay",
      "card",
      "cash",
      "bank_transfer",
      "other"
    ];


    if (
      !allowedMethods.includes(
        paymentMethod
      )
    ) {

      return badRequest(
        "Invalid payment method."
      );
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

      return badRequest(
        "Customer not found."
      );
    }


    let customerPackage = null;


    if (customerPackageId) {
      customerPackage =
        await env.DB
          .prepare(`
            SELECT
              cp.id,
              cp.customer_id,
              cp.price_minor,
              cp.status,

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
                  ON p.id = cpp.payment_id
                WHERE cpp.customer_package_id = cp.id
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

            WHERE
              cp.id = ?
              AND cp.business_id = ?

            LIMIT 1
          `)
          .bind(
            customerPackageId,
            user.business_id
          )
          .first();


      if (!customerPackage) {
        return badRequest(
          "Customer package not found."
        );
      }


      if (
        customerPackage.customer_id !==
          customerId
      ) {
        return badRequest(
          "Package does not belong to the selected customer."
        );
      }


      if (
        customerPackage.status ===
          "cancelled" ||
        customerPackage.status ===
          "expired"
      ) {
        return badRequest(
          "A payment cannot be recorded against this package."
        );
      }


      const packageOutstanding =
        Math.max(
          Number(
            customerPackage.price_minor ||
            0
          ) -
          Number(
            customerPackage.paid_minor ||
            0
          ) -
          Number(
            customerPackage.consultation_credit_minor ||
            0
          ),
          0
        );


      if (
        amountMinor >
          packageOutstanding
      ) {
        return badRequest(
          `Payment cannot exceed the remaining package balance of ${(
            packageOutstanding /
            100
          ).toFixed(2)}.`
        );
      }
    }


    let appointment = null;


    if (appointmentId) {

      appointment =
        await env.DB
          .prepare(`
            SELECT
              id,
              customer_id,
              price_minor,
              consultation_credit_minor,
              status

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

        return badRequest(
          "Appointment not found."
        );
      }


      if (
        appointment.customer_id !==
        customerId
      ) {

        return badRequest(
          "Appointment does not belong to the selected customer."
        );
      }


      if (
        String(
          appointment.status ||
          ""
        ).toLowerCase() ===
          "cancelled"
      ) {

        return badRequest(
          "A payment cannot be recorded against a cancelled appointment."
        );
      }


      const paymentSummary =
        await env.DB
          .prepare(`
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN
                      payment_type = 'refund'
                    THEN -ABS(amount_minor)

                    WHEN
                      payment_type != 'refund'
                      AND status IN (
                        'paid',
                        'partially_refunded',
                        'refunded'
                      )
                    THEN amount_minor

                    ELSE 0
                  END
                ),
                0
              ) AS net_paid_minor

            FROM payments

            WHERE
              business_id = ?
              AND appointment_id = ?
              AND status IN (
                'paid',
                'partially_refunded',
                'refunded'
              )
          `)
          .bind(
            user.business_id,
            appointmentId
          )
          .first();


      const appointmentPriceMinor =
        Number(
          appointment.price_minor ||
          0
        );


      const netPaidMinor =
        Number(
          paymentSummary?.net_paid_minor ||
          0
        );


      const outstandingMinor =
        Math.max(
          appointmentPriceMinor -
          netPaidMinor -
          Number(
            appointment.consultation_credit_minor ||
            0
          ),
          0
        );


      if (
        outstandingMinor <= 0
      ) {

        return badRequest(
          "This appointment has already been paid in full."
        );
      }


      if (
        amountMinor >
        outstandingMinor
      ) {

        return badRequest(
          `Payment cannot exceed the remaining outstanding balance of ${
            (
              outstandingMinor /
              100
            ).toFixed(2)
          }.`
        );
      }
    }


    const providerRecord =
      await env.DB
        .prepare(`
          SELECT
            pp.provider_key,

            COALESCE(
              bpp.is_enabled,
              CASE
                WHEN
                  pp.provider_key =
                    'manual'
                THEN 1
                ELSE 0
              END
            ) AS is_enabled

          FROM payment_providers pp

          LEFT JOIN
            business_payment_providers
            bpp

            ON bpp.provider_key =
               pp.provider_key
            AND bpp.business_id = ?

          WHERE
            pp.provider_key = ?
            AND pp.is_available = 1

          LIMIT 1
        `)
        .bind(
          user.business_id,
          provider
        )
        .first();


    if (
      !providerRecord ||
      providerRecord.is_enabled !== 1
    ) {

      return badRequest(
        "Selected payment provider is not enabled."
      );
    }


    const id =
      `pay_${
        crypto.randomUUID()
      }`;


    await env.DB
      .prepare(`
        INSERT INTO payments (
          id,
          business_id,
          appointment_id,
          customer_id,
          provider,
          payment_type,
          amount_minor,
          currency,
          status,
          provider_reference,
          paid_at,
          payment_method,
          notes
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          'paid',
          ?,
          CURRENT_TIMESTAMP,
          ?,
          ?
        )
      `)
      .bind(
        id,
        user.business_id,
        appointmentId || null,
        customerId,
        provider,
        paymentType,
        amountMinor,
        user.currency ||
          "GBP",
        providerReference || null,
        paymentMethod,
        notes || null
      )
      .run();


    if (customerPackageId) {
      await env.DB
        .prepare(`
          INSERT INTO customer_package_payments (
            customer_package_id,
            payment_id
          )
          VALUES (?, ?)
        `)
        .bind(
          customerPackageId,
          id
        )
        .run();
    }


    if (appointmentId) {
      await runServiceFormAutomation({
        env,
        businessId:
          user.business_id,
        appointmentId,
        triggerEvent:
          "payment_received",
        baseUrl:
          new URL(request.url).origin,
        createdByUserId:
          user.user_id
      });
    }


    try {
      await sendPaymentReceipt({
        env,
        businessId:
          user.business_id,
        paymentId:
          id,
        baseUrl:
          new URL(request.url).origin
      });
    } catch (emailError) {
      console.error(
        "Automatic payment receipt failed:",
        emailError
      );
    }


    return Response.json({
      ok: true,
      payment: {
        id
      }
    });


  } catch (error) {

    console.error(
      "Payment creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to record payment."
      },
      {
        status: 500
      }
    );
  }
}


async function createRefund({
  body,
  user,
  env
}) {

  const paymentId =
    String(
      body.payment_id ||
      ""
    ).trim();

  const amountMinor =
    Number(
      body.amount_minor
    );

  const notes =
    String(
      body.notes ||
      ""
    ).trim();


  if (
    !paymentId ||
    !Number.isInteger(
      amountMinor
    ) ||
    amountMinor <= 0
  ) {

    return badRequest(
      "Payment and refund amount are required."
    );
  }


  const original =
    await env.DB
      .prepare(`
        SELECT
          id,
          appointment_id,
          customer_id,
          provider,
          payment_method,
          amount_minor,
          currency,
          status,
          payment_type

        FROM payments

        WHERE
          id = ?
          AND business_id = ?

        LIMIT 1
      `)
      .bind(
        paymentId,
        user.business_id
      )
      .first();


  if (!original) {

    return notFound(
      "Payment not found."
    );
  }


  if (
    original.payment_type ===
      "refund" ||
    original.status !==
      "paid"
  ) {

    return badRequest(
      "This payment cannot be refunded."
    );
  }


  const existingRefunds =
    await env.DB
      .prepare(`
        SELECT
          COALESCE(
            SUM(amount_minor),
            0
          ) AS total

        FROM payments

        WHERE
          business_id = ?
          AND payment_type =
              'refund'
          AND status = 'paid'
          AND (
            provider_reference =
              ?
            OR instr(
              COALESCE(notes, ''),
              ?
            ) > 0
          )
      `)
      .bind(
        user.business_id,
        `refund:${paymentId}`,
        `original_payment=${paymentId}`
      )
      .first();


  const alreadyRefunded =
    Number(
      existingRefunds?.total ||
      0
    );


  const refundable =
    Number(
      original.amount_minor
    ) -
    alreadyRefunded;


  if (
    amountMinor >
    refundable
  ) {

    return badRequest(
      "Refund amount exceeds the remaining refundable amount."
    );
  }


  const refundId =
    `pay_${
      crypto.randomUUID()
    }`;


  const refundNotes = [
    `original_payment=${paymentId}`,
    notes
  ]
    .filter(Boolean)
    .join(" · ");


  await env.DB
    .prepare(`
      INSERT INTO payments (
        id,
        business_id,
        appointment_id,
        customer_id,
        provider,
        payment_type,
        amount_minor,
        currency,
        status,
        provider_reference,
        paid_at,
        payment_method,
        notes
      )

      VALUES (
        ?, ?, ?, ?, ?,
        'refund',
        ?, ?,
        'paid',
        ?,
        CURRENT_TIMESTAMP,
        ?,
        ?
      )
    `)
    .bind(
      refundId,
      user.business_id,
      original.appointment_id ||
        null,
      original.customer_id ||
        null,
      original.provider,
      amountMinor,
      original.currency ||
        user.currency ||
        "GBP",
      `refund:${paymentId}`,
      original.payment_method ||
        "other",
      refundNotes
    )
    .run();


  return Response.json({
    ok: true,
    refund: {
      id:
        refundId
    }
  });
}
