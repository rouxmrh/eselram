import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../lib/stripe-business.js";

import {
  sendPaymentReceipt
} from "../../../lib/communications.js";

import {
  finalizePackageSale
} from "../../../lib/package-sales.js";

import {
  setDiscountAdjustmentStatus
} from "../../../lib/payment-discounts.js";


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


export async function onRequestGet({
  request,
  env
}) {
  try {
    const url =
      new URL(
        request.url
      );

    const saleId =
      String(
        url.searchParams.get(
          "sale_id"
        ) ||
        ""
      ).trim();

    const sessionId =
      String(
        url.searchParams.get(
          "session_id"
        ) ||
        ""
      ).trim();

    if (
      !saleId ||
      !sessionId.startsWith(
        "cs_"
      )
    ) {
      return badRequest(
        "A valid package sale and Stripe Checkout Session are required."
      );
    }

    const sale =
      await env.DB.prepare(`
        SELECT
          ps.id,
          ps.business_id,
          ps.payment_id,
          ps.provider_reference,
          ps.customer_package_id,
          ps.status
        FROM package_sales ps
        WHERE
          ps.id = ?
          AND ps.source = 'staff'
          AND ps.provider_reference = ?
        LIMIT 1
      `).bind(
        saleId,
        sessionId
      ).first();

    if (!sale) {
      return Response.json(
        {
          ok: false,
          error:
            "Package payment was not found."
        },
        {
          status: 404
        }
      );
    }

    if (
      sale.status === "paid" &&
      sale.customer_package_id
    ) {
      return Response.json({
        ok: true,
        paid: true,
        customer_package_id:
          sale.customer_package_id
      });
    }

    const integration =
      await getBusinessStripeIntegration(
        env,
        sale.business_id
      );

    if (
      integration.error ||
      integration.row.status !==
        "verified"
    ) {
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

    const result =
      await stripeRequest({
        secretKey:
          integration.secretKey,
        path:
          `/v1/checkout/sessions/${encodeURIComponent(
            sessionId
          )}`
      });

    if (!result.response.ok) {
      return Response.json(
        {
          ok: false,
          error:
            stripeErrorMessage(
              result.data,
              "Unable to verify package payment."
            )
        },
        {
          status: 502
        }
      );
    }

    const session =
      result.data || {};

    if (
      String(
        session?.metadata
          ?.package_sale_id ||
        ""
      ) !== sale.id ||
      String(
        session?.metadata
          ?.business_id ||
        ""
      ) !== sale.business_id
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Stripe package payment reference did not match."
        },
        {
          status: 409
        }
      );
    }

    if (
      session.payment_status !==
      "paid"
    ) {
      return Response.json({
        ok: true,
        paid: false,
        status:
          session.status ||
          "pending"
      });
    }

    await env.DB.prepare(`
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
        notes = CASE
          WHEN COALESCE(notes, '') = '' THEN
            'Stripe package payment confirmed on customer return'
          WHEN instr(
            COALESCE(notes, ''),
            'Stripe package payment confirmed on customer return'
          ) > 0 THEN notes
          ELSE
            notes ||
            ' · Stripe package payment confirmed on customer return'
        END,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE
        id = ?
        AND business_id = ?
    `).bind(
      session.id,
      String(
        session.payment_method_types?.[0] ||
        "card"
      ),
      sale.payment_id,
      sale.business_id
    ).run();

    const finalized =
      await finalizePackageSale({
        env,
        session,
        paid: true
      });

    await setDiscountAdjustmentStatus({
      env,
      businessId: sale.business_id,
      paymentId: sale.payment_id,
      status: "paid",
      customerPackageId: finalized?.customer_package_id || null
    });

    try {
      await sendPaymentReceipt({
        env,
        businessId:
          sale.business_id,
        paymentId:
          sale.payment_id
      });
    } catch (error) {
      console.error(
        "Package payment confirmation email failed:",
        error
      );
    }

    return Response.json({
      ok: true,
      paid: true,
      customer_package_id:
        finalized
          ?.customer_package_id ||
        null
    });

  } catch (error) {
    console.error(
      "Public package payment confirmation failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to confirm package payment."
      },
      {
        status: 500
      }
    );
  }
}
