import {
  readSessionToken,
  hashSessionToken
} from "../../../../lib/auth.js";

import {
  getBusinessStripeIntegration,
  stripeRequest,
  stripeErrorMessage
} from "../../../../lib/stripe-business.js";


async function getUserContext(request, env) {
  const token =
    readSessionToken(request);

  if (!token) {
    return null;
  }

  const tokenHash =
    await hashSessionToken(token);

  return await env.DB.prepare(`
    SELECT
      u.business_id,
      b.name AS business_name,
      b.website,
      b.currency
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN businesses b ON b.id = u.business_id
    WHERE
      s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();
}


function badRequest(message) {
  return Response.json(
    { ok:false, error:message },
    { status:400 }
  );
}



function safeBusinessWebsite(
  value
) {
  const raw =
    String(
      value ||
      ""
    ).trim();

  if (!raw) {
    return "";
  }

  let parsed;

  try {
    parsed =
      new URL(
        raw
      );
  } catch {
    try {
      parsed =
        new URL(
          `https://${raw}`
        );
    } catch {
      return "";
    }
  }

  if (
    ![
      "http:",
      "https:"
    ].includes(
      parsed.protocol
    )
  ) {
    return "";
  }

  return parsed.toString();
}


export async function onRequestPost({request, env}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return Response.json(
        {
          ok:false,
          error:"Authentication required."
        },
        {
          status:401
        }
      );
    }

    const body =
      await request.json();

    const customerPackageId =
      String(
        body.customer_package_id ||
        ""
      ).trim();

    if (!customerPackageId) {
      return badRequest(
        "Customer package is required."
      );
    }

    const item =
      await env.DB.prepare(`
        SELECT
          cp.id,
          cp.customer_id,
          cp.name_snapshot,
          cp.price_minor,
          cp.status,
          c.email,

          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN p.payment_type='refund'
                       AND p.status='paid'
                    THEN -ABS(p.amount_minor)
                  WHEN p.payment_type!='refund'
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
                ON p.id=cpp.payment_id
              WHERE cpp.customer_package_id=cp.id
            ),
            0
          ) AS paid_minor,

          COALESCE(
            (
              SELECT SUM(ps.consultation_credit_minor)
              FROM package_sales ps
              WHERE
                ps.business_id=cp.business_id
                AND ps.customer_package_id=cp.id
                AND ps.status='paid'
            ),
            0
          ) AS consultation_credit_minor

        FROM customer_packages cp
        JOIN customers c
          ON c.id=cp.customer_id
        WHERE
          cp.id=?
          AND cp.business_id=?
        LIMIT 1
      `).bind(
        customerPackageId,
        user.business_id
      ).first();

    if (!item) {
      return badRequest(
        "Customer package was not found."
      );
    }

    if (
      ["cancelled","expired"].includes(
        String(item.status || "")
      )
    ) {
      return badRequest(
        "This package cannot accept payment."
      );
    }

    if (!item.email) {
      return badRequest(
        "Add an email address to the customer before creating a payment link."
      );
    }

    const outstandingMinor =
      Math.max(
        Number(item.price_minor || 0) -
        Number(item.paid_minor || 0) -
        Number(item.consultation_credit_minor || 0),
        0
      );

    if (outstandingMinor <= 0) {
      return badRequest(
        "This package is already fully paid."
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
          ok:false,
          error:integration.error
        },
        {
          status:503
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

    const paymentId =
      `pay_${crypto.randomUUID()}`;

    const currency =
      String(
        integration.config.currency ||
        user.currency ||
        "GBP"
      ).toUpperCase();

    await env.DB.prepare(`
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
        ?, ?, NULL, ?, 'stripe',
        'balance', ?, ?, 'pending',
        'card', ?
      )
    `).bind(
      paymentId,
      user.business_id,
      item.customer_id,
      outstandingMinor,
      currency,
      `Package balance: ${item.name_snapshot}`
    ).run();

    const origin =
      new URL(request.url).origin;

    const params =
      new URLSearchParams();

    params.set(
      "mode",
      "payment"
    );

    const businessWebsite =
      safeBusinessWebsite(
        user.website
      );

    const returnQuery =
      new URLSearchParams({
        business:
          user.business_name ||
          "the business",
        website:
          businessWebsite
      });

    params.set(
      "success_url",
      `${origin}/payment-result/?status=success&session_id={CHECKOUT_SESSION_ID}&${returnQuery.toString()}`
    );

    params.set(
      "cancel_url",
      `${origin}/payment-result/?status=cancelled&${returnQuery.toString()}`
    );

    params.set(
      "customer_email",
      item.email
    );

    params.set(
      "client_reference_id",
      customerPackageId
    );

    params.set(
      "line_items[0][price_data][currency]",
      currency.toLowerCase()
    );

    params.set(
      "line_items[0][price_data][unit_amount]",
      String(outstandingMinor)
    );

    params.set(
      "line_items[0][price_data][product_data][name]",
      `${item.name_snapshot} balance`
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
      "metadata[customer_package_id]",
      customerPackageId
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
      "payment_intent_data[metadata][customer_package_id]",
      customerPackageId
    );

    const result =
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
      !result.response.ok ||
      !result.data?.id ||
      !result.data?.url
    ) {
      const message =
        stripeErrorMessage(
          result.data,
          "Unable to create Stripe Checkout."
        );

      await env.DB.prepare(`
        UPDATE payments
        SET
          status='failed',
          notes=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE
          id=?
          AND business_id=?
      `).bind(
        message.slice(0,1000),
        paymentId,
        user.business_id
      ).run();

      return Response.json(
        {
          ok:false,
          error:message
        },
        {
          status:502
        }
      );
    }

    await env.DB.prepare(`
      UPDATE payments
      SET
        provider_reference=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE
        id=?
        AND business_id=?
    `).bind(
      result.data.id,
      paymentId,
      user.business_id
    ).run();

    return Response.json({
      ok:true,
      checkout:{
        payment_id:paymentId,
        session_id:result.data.id,
        url:result.data.url,
        amount_minor:outstandingMinor,
        currency,
        payment_type:"balance"
      }
    });

  } catch (error) {
    console.error(
      "Package Stripe Checkout failed:",
      error
    );

    return Response.json(
      {
        ok:false,
        error:"Unable to create package payment link."
      },
      {
        status:500
      }
    );
  }
}
