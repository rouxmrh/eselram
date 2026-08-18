import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  sendPaymentLinkEmail
} from "../../../lib/communications.js";


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

    const body =
      await request.json();

    const appointmentId =
      String(
        body.appointment_id ||
        ""
      ).trim();

    const packageSaleId =
      String(
        body.package_sale_id ||
        ""
      ).trim();

    const paymentId =
      String(
        body.payment_id ||
        ""
      ).trim();

    const checkoutUrl =
      String(
        body.checkout_url ||
        ""
      ).trim();

    if (
      (
        !appointmentId &&
        !packageSaleId
      ) ||
      !paymentId ||
      !checkoutUrl
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "A booking or package sale, payment and checkout link are required."
        },
        {
          status: 400
        }
      );
    }

    const result =
      await sendPaymentLinkEmail({
        env,
        businessId:
          user.business_id,
        appointmentId:
          appointmentId || null,
        packageSaleId:
          packageSaleId || null,
        paymentId,
        checkoutUrl
      });

    if (!result.ok) {
      return Response.json(
        result,
        {
          status: 502
        }
      );
    }

    return Response.json(
      result
    );
  } catch (error) {
    console.error(
      "Payment link email failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to email the payment link."
      },
      {
        status: 500
      }
    );
  }
}
