import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../../lib/stripe-business.js";


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
        b.name AS business_name,
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
        a.price_minor,
        a.deposit_due_minor,
        a.consultation_credit_minor,

        c.first_name,
        c.last_name,
        c.email,

        s.name AS service_name,
        s.payment_timing,
        s.deposit_minor

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


async function getNetPaid(
  env,
  businessId,
  appointmentId
) {

  const row =
    await env.DB
      .prepare(`
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN
                  payment_type = 'refund'
                  AND status = 'paid'
                THEN -ABS(amount_minor)

                WHEN
                  payment_type != 'refund'
                  AND status IN (
                    'paid',
                    'refunded',
                    'partially_refunded'
                  )
                THEN amount_minor

                ELSE 0
              END
            ),
            0
          ) AS net_paid

        FROM payments

        WHERE
          business_id = ?
          AND appointment_id = ?
      `)
      .bind(
        businessId,
        appointmentId
      )
      .first();


  return Math.max(
    0,
    Number(
      row?.net_paid ||
      0
    )
  );
}


async function getReusablePendingCheckout({
  env,
  integration,
  businessId,
  appointmentId,
  plan
}) {

  const pending =
    await env.DB
      .prepare(`
        SELECT
          id,
          payment_type,
          amount_minor,
          currency,
          provider_reference

        FROM payments

        WHERE
          business_id = ?
          AND appointment_id = ?
          AND provider = 'stripe'
          AND status = 'pending'
          AND provider_reference IS NOT NULL
          AND provider_reference != ''

        ORDER BY
          datetime(created_at) DESC

        LIMIT 1
      `)
      .bind(
        businessId,
        appointmentId
      )
      .first();


  if (!pending) {
    return {
      checkout: null,
      paymentStateChanged: false
    };
  }


  const sessionResult =
    await stripeRequest({
      secretKey:
        integration.secretKey,
      path:
        `/v1/checkout/sessions/${encodeURIComponent(
          pending.provider_reference
        )}`
    });


  if (
    sessionResult.response.ok &&
    sessionResult.data?.status ===
      "open" &&
    sessionResult.data?.url
  ) {

    const amountMatches =
      Number(
        pending.amount_minor ||
        0
      ) ===
      Number(
        plan.amountMinor ||
        0
      );


    const typeMatches =
      String(
        pending.payment_type ||
        ""
      ) ===
      String(
        plan.paymentType ||
        ""
      );


    if (
      amountMatches &&
      typeMatches
    ) {

      return {
        checkout: {
          payment_id:
            pending.id,
          session_id:
            sessionResult.data.id,
          url:
            sessionResult.data.url,
          amount_minor:
            Number(
              pending.amount_minor ||
              0
            ),
          currency:
            String(
              pending.currency ||
              "GBP"
            ).toUpperCase(),
          payment_type:
            pending.payment_type
        },
        paymentStateChanged: false
      };
    }


    /*
      The appointment's financial state has changed since this
      Checkout was created. Never reuse a stale amount.

      Best effort: expire the old Stripe Checkout so the customer
      cannot accidentally pay an obsolete amount.
    */
    try {

      await stripeRequest({
        secretKey:
          integration.secretKey,
        path:
          `/v1/checkout/sessions/${encodeURIComponent(
            pending.provider_reference
          )}/expire`,
        method:
          "POST",
        body:
          new URLSearchParams()
      });

    } catch (error) {

      console.error(
        "Unable to expire superseded Stripe Checkout:",
        error
      );
    }


    await env.DB
      .prepare(`
        UPDATE payments

        SET
          status = 'failed',
          notes = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
          AND status = 'pending'
      `)
      .bind(
        `Superseded Stripe Checkout. Previous ${String(
          pending.payment_type ||
          "payment"
        )} ${Number(
          pending.amount_minor ||
          0
        )}; current ${String(
          plan.paymentType ||
          "payment"
        )} ${Number(
          plan.amountMinor ||
          0
        )}.`,
        pending.id,
        businessId
      )
      .run();


    return {
      checkout: null,
      paymentStateChanged: true
    };
  }


  if (
    sessionResult.response.ok &&
    (
      sessionResult.data?.status ===
        "expired" ||
      sessionResult.data?.status ===
        "complete"
    )
  ) {

    const paid =
      sessionResult.data.status ===
        "complete" &&
      sessionResult.data.payment_status ===
        "paid";


    await env.DB
      .prepare(`
        UPDATE payments

        SET
          status =
            CASE
              WHEN ?
              THEN 'paid'
              ELSE 'failed'
            END,

          paid_at =
            CASE
              WHEN ?
              THEN COALESCE(
                paid_at,
                CURRENT_TIMESTAMP
              )
              ELSE paid_at
            END,

          notes =
            CASE
              WHEN ?
              THEN 'Stripe Checkout payment confirmed while checking existing session'
              ELSE 'Stripe Checkout session is no longer payable'
            END,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
          AND status = 'pending'
      `)
      .bind(
        paid ? 1 : 0,
        paid ? 1 : 0,
        paid ? 1 : 0,
        pending.id,
        businessId
      )
      .run();


    return {
      checkout: null,
      paymentStateChanged: true
    };
  }


  /*
    Stripe could not confirm that the old session is currently
    payable. Do not silently reuse it.
  */
  await env.DB
    .prepare(`
      UPDATE payments

      SET
        status = 'failed',
        notes =
          'Stripe Checkout could not be verified and was superseded.',
        updated_at =
          CURRENT_TIMESTAMP

      WHERE
        id = ?
        AND business_id = ?
        AND status = 'pending'
    `)
    .bind(
      pending.id,
      businessId
    )
    .run();


  return {
    checkout: null,
    paymentStateChanged: true
  };
}

function getChargePlan(
  appointment,
  netPaid
) {

  const price =
    Math.max(
      0,
      Number(
        appointment.price_minor ||
        0
      )
    );


  const consultationCredit =
    Math.max(
      0,
      Number(
        appointment.consultation_credit_minor ||
        0
      )
    );


  const deposit =
    Math.max(
      0,
      Number(
        appointment.deposit_due_minor ??
        appointment.deposit_minor ??
        0
      )
    );


  if (
    appointment.payment_timing ===
    "free" ||
    price <= 0
  ) {

    return {
      error:
        "This appointment does not require payment."
    };
  }


  if (
    appointment.payment_timing ===
    "online_deposit" &&
    (
      netPaid +
      consultationCredit
    ) < deposit
  ) {

    return {
      paymentType:
        "deposit",
      amountMinor:
        Math.max(
          0,
          deposit -
          netPaid -
          consultationCredit
        ),
      label:
        `${appointment.service_name} deposit`
    };
  }


  const outstanding =
    Math.max(
      0,
      price -
      consultationCredit -
      netPaid
    );


  if (
    outstanding <= 0
  ) {

    return {
      error:
        "This appointment has already been paid in full."
    };
  }


  return {
    paymentType:
      (
        netPaid > 0 ||
        consultationCredit > 0
      )
        ? "balance"
        : "full",
    amountMinor:
      outstanding,
    label:
      (
        netPaid > 0 ||
        consultationCredit > 0
      )
        ? `${appointment.service_name} balance`
        : appointment.service_name
  };
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


    const appointmentId =
      String(
        body.appointment_id ||
        ""
      ).trim();


    if (!appointmentId) {

      return badRequest(
        "Appointment id is required."
      );
    }


    const appointment =
      await getAppointment(
        env,
        user.business_id,
        appointmentId
      );


    if (!appointment) {

      return Response.json(
        {
          ok: false,
          error:
            "Appointment not found."
        },
        {
          status: 404
        }
      );
    }


    if (
      appointment.status ===
      "cancelled"
    ) {

      return badRequest(
        "A payment link cannot be created for a cancelled appointment."
      );
    }


    if (!appointment.email) {

      return badRequest(
        "Add an email address to the customer before creating a Stripe Checkout link."
      );
    }


    const integration =
      await getBusinessStripeIntegration(
        env,
        user.business_id
      );


    if (integration.error) {

      return Response.json(
        {
          ok: false,
          error:
            integration.error
        },
        {
          status: 503
        }
      );
    }


    if (
      integration.row.status !==
      "verified"
    ) {

      return badRequest(
        "Test the Stripe connection in Settings → Payments before creating Checkout links."
      );
    }


    let netPaid =
      await getNetPaid(
        env,
        user.business_id,
        appointment.id
      );


    let plan =
      getChargePlan(
        appointment,
        netPaid
      );


    if (plan.error) {

      return badRequest(
        plan.error
      );
    }


    const reusableResult =
      await getReusablePendingCheckout({
        env,
        integration,
        businessId:
          user.business_id,
        appointmentId:
          appointment.id,
        plan
      });


    if (
      reusableResult.checkout
    ) {

      return Response.json({
        ok: true,
        reused: true,
        checkout: {
          ...reusableResult.checkout,
          customer_email:
            appointment.email
        }
      });
    }


    /*
      Checking an older Checkout may have changed a pending
      payment to paid/failed. Recalculate before creating a
      replacement Checkout.
    */
    if (
      reusableResult
        .paymentStateChanged
    ) {

      netPaid =
        await getNetPaid(
          env,
          user.business_id,
          appointment.id
        );


      plan =
        getChargePlan(
          appointment,
          netPaid
        );


      if (plan.error) {

        return badRequest(
          plan.error
        );
      }
    }


    const paymentId =
      `pay_${
        crypto.randomUUID()
      }`;


    const currency =
      String(
        integration.config.currency ||
        user.currency ||
        "GBP"
      ).toLowerCase();


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
          payment_method,
          notes
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          'stripe',
          ?,
          ?,
          ?,
          'pending',
          'card',
          'Stripe Checkout session created'
        )
      `)
      .bind(
        paymentId,
        user.business_id,
        appointment.id,
        appointment.customer_id,
        plan.paymentType,
        plan.amountMinor,
        currency.toUpperCase()
      )
      .run();


    const origin =
      new URL(
        request.url
      ).origin;


    const params =
      new URLSearchParams();


    params.set(
      "mode",
      "payment"
    );


    params.set(
      "success_url",
      `${origin}/payments/stripe-success/?session_id={CHECKOUT_SESSION_ID}`
    );


    params.set(
      "cancel_url",
      `${origin}/payments/stripe-cancelled/?appointment_id=${encodeURIComponent(
        appointment.id
      )}`
    );


    params.set(
      "customer_email",
      appointment.email
    );


    params.set(
      "client_reference_id",
      appointment.id
    );


    params.set(
      "line_items[0][price_data][currency]",
      currency
    );


    params.set(
      "line_items[0][price_data][unit_amount]",
      String(
        plan.amountMinor
      )
    );


    params.set(
      "line_items[0][price_data][product_data][name]",
      plan.label
    );


    params.set(
      "line_items[0][quantity]",
      "1"
    );


    params.set(
      "metadata[payment_id]",
      paymentId
    );


    params.set(
      "metadata[business_id]",
      user.business_id
    );


    params.set(
      "metadata[appointment_id]",
      appointment.id
    );


    params.set(
      "payment_intent_data[metadata][payment_id]",
      paymentId
    );


    params.set(
      "payment_intent_data[metadata][business_id]",
      user.business_id
    );


    params.set(
      "payment_intent_data[metadata][appointment_id]",
      appointment.id
    );


    const {
      response,
      data
    } =
      await stripeRequest({
        secretKey:
          integration.secretKey,
        path:
          "/v1/checkout/sessions",
        method:
          "POST",
        body:
          params
      });


    if (
      !response.ok ||
      !data?.id ||
      !data?.url
    ) {

      const errorMessage =
        stripeErrorMessage(
          data,
          "Unable to create Stripe Checkout."
        );


      await env.DB
        .prepare(`
          UPDATE payments

          SET
            status = 'failed',
            notes = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          errorMessage.slice(
            0,
            1000
          ),
          paymentId,
          user.business_id
        )
        .run();


      return Response.json(
        {
          ok: false,
          error:
            errorMessage
        },
        {
          status: 502
        }
      );
    }


    await env.DB
      .prepare(`
        UPDATE payments

        SET
          provider_reference = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        data.id,
        paymentId,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true,

      checkout: {
        payment_id:
          paymentId,
        session_id:
          data.id,
        url:
          data.url,
        amount_minor:
          plan.amountMinor,
        currency:
          currency.toUpperCase(),
        payment_type:
          plan.paymentType,
        customer_email:
          appointment.email
      }
    });


  } catch (error) {

    console.error(
      "Stripe Checkout creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to create the Stripe Checkout link."
      },
      {
        status: 500
      }
    );
  }
}
