import {
  sendPaymentReceipt
} from "../../../../lib/communications.js";

import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../../lib/stripe-business.js";


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


async function markPaid({
  env,
  payment,
  session
}) {

  await env.DB
    .prepare(`
      UPDATE payments

      SET
        status = 'paid',
        provider_reference = ?,
        payment_method = ?,
        paid_at =
          COALESCE(
            paid_at,
            CURRENT_TIMESTAMP
          ),
        notes =
          'Stripe Checkout payment confirmed',
        updated_at =
          CURRENT_TIMESTAMP

      WHERE
        id = ?
        AND business_id = ?
        AND status != 'paid'
    `)
    .bind(
      session.id,
      String(
        session.payment_method_types?.[0] ||
        "card"
      ),
      payment.id,
      payment.business_id
    )
    .run();
}


export async function onRequestGet({
  request,
  env
}) {

  try {

    const url =
      new URL(
        request.url
      );


    const sessionId =
      String(
        url.searchParams.get(
          "session_id"
        ) ||
        ""
      ).trim();


    if (
      !sessionId.startsWith(
        "cs_"
      )
    ) {

      return badRequest(
        "A valid Stripe Checkout Session id is required."
      );
    }


    const payment =
      await env.DB
        .prepare(`
          SELECT
            id,
            business_id,
            appointment_id,
            customer_id,
            amount_minor,
            currency,
            status,
            provider_reference

          FROM payments

          WHERE
            provider = 'stripe'
            AND provider_reference = ?

          LIMIT 1
        `)
        .bind(
          sessionId
        )
        .first();


    if (!payment) {

      return Response.json(
        {
          ok: false,
          error:
            "Payment record not found."
        },
        {
          status: 404
        }
      );
    }


    const integration =
      await getBusinessStripeIntegration(
        env,
        payment.business_id
      );


    if (integration.error) {

      return Response.json(
        {
          ok: false,
          error:
            "Stripe verification is temporarily unavailable."
        },
        {
          status: 503
        }
      );
    }


    const {
      response,
      data
    } =
      await stripeRequest({
        secretKey:
          integration.secretKey,
        path:
          `/v1/checkout/sessions/${encodeURIComponent(
            sessionId
          )}`
      });


    if (!response.ok) {

      return Response.json(
        {
          ok: false,
          error:
            stripeErrorMessage(
              data,
              "Unable to verify the Stripe Checkout Session."
            )
        },
        {
          status: 502
        }
      );
    }


    if (
      data.payment_status ===
      "paid"
    ) {

      await markPaid({
        env,
        payment,
        session:
          data
      });

      const customerPackageId =
        String(
          data?.metadata?.customer_package_id ||
          ""
        ).trim();

      if (customerPackageId) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO customer_package_payments (
            customer_package_id,
            payment_id
          )
          SELECT ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM customer_packages
            WHERE id = ?
              AND business_id = ?
          )
        `).bind(
          customerPackageId,
          payment.id,
          customerPackageId,
          payment.business_id
        ).run();
      }

      try {
        await sendPaymentReceipt({
          env,
          businessId:
            payment.business_id,
          paymentId:
            payment.id,
          baseUrl:
            new URL(request.url).origin
        });
      } catch (emailError) {
        console.error(
          "Stripe payment receipt fallback failed:",
          emailError
        );
      }
    }


    return Response.json(
      {
        ok: true,

        payment: {
          status:
            data.payment_status ===
            "paid"
              ? "paid"
              : payment.status,
          amount_minor:
            payment.amount_minor,
          currency:
            payment.currency,
          appointment_id:
            payment.appointment_id
        },

        stripe: {
          payment_status:
            data.payment_status,
          status:
            data.status
        }
      },
      {
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (error) {

    console.error(
      "Stripe Checkout status failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to verify payment status."
      },
      {
        status: 500
      }
    );
  }
}
