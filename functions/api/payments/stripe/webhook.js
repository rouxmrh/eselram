import {
  runServiceFormAutomation
} from "../../../../lib/form-automation.js";

import {
  sendAppointmentCommunication,
  sendPaymentReceipt
} from "../../../../lib/communications.js";

import {
  getBusinessStripeIntegration,
  stripeRequest
} from "../../../../lib/stripe-business.js";


const encoder =
  new TextEncoder();


function bytesToHex(
  bytes
) {

  return Array.from(
    new Uint8Array(
      bytes
    )
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}


function safeEqual(
  left,
  right
) {

  const a =
    String(
      left ||
      ""
    );


  const b =
    String(
      right ||
      ""
    );


  if (
    a.length !==
    b.length
  ) {
    return false;
  }


  let result = 0;


  for (
    let index = 0;
    index < a.length;
    index += 1
  ) {

    result |=
      a.charCodeAt(index) ^
      b.charCodeAt(index);
  }


  return result === 0;
}


function parseStripeSignature(
  header
) {

  const result = {
    timestamp:
      null,
    signatures: []
  };


  String(
    header ||
    ""
  )
    .split(",")
    .forEach(
      part => {

        const [
          key,
          value
        ] =
          part
            .trim()
            .split(
              "=",
              2
            );


        if (
          key === "t"
        ) {

          result.timestamp =
            Number(
              value
            );
        }


        if (
          key === "v1" &&
          value
        ) {

          result.signatures.push(
            value
          );
        }
      }
    );


  return result;
}


async function verifySignature({
  payload,
  signatureHeader,
  secret,
  toleranceSeconds = 300
}) {

  const parsed =
    parseStripeSignature(
      signatureHeader
    );


  if (
    !parsed.timestamp ||
    parsed.signatures.length === 0
  ) {

    return false;
  }


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  if (
    Math.abs(
      now -
      parsed.timestamp
    ) >
    toleranceSeconds
  ) {

    return false;
  }


  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(
        secret
      ),
      {
        name:
          "HMAC",
        hash:
          "SHA-256"
      },
      false,
      [
        "sign"
      ]
    );


  const signed =
    `${parsed.timestamp}.${payload}`;


  const digest =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(
        signed
      )
    );


  const expected =
    bytesToHex(
      digest
    );


  return parsed.signatures.some(
    signature =>
      safeEqual(
        expected,
        signature
      )
  );
}


async function finalizePackageSale({
  env,
  session,
  paid
}) {
  const saleId = String(
    session?.metadata?.package_sale_id || ""
  ).trim();

  const businessId = String(
    session?.metadata?.business_id || ""
  ).trim();

  if (!saleId || !businessId) {
    return;
  }

  const sale = await env.DB.prepare(`
    SELECT
      ps.id,
      ps.customer_id,
      ps.package_template_id,
      ps.payment_id,
      ps.customer_package_id,
      ps.status,
      ps.consultation_credit_minor,
      ps.package_variant_id,
      COALESCE(pv.service_id, pt.service_id) AS service_id,
      CASE
        WHEN pv.id IS NOT NULL
          THEN pt.name || ' · ' || pv.name
        ELSE pt.name
      END AS name,
      pt.sessions_total,
      COALESCE(pv.price_minor, pt.price_minor) AS price_minor,
      pt.validity_days
    FROM package_sales ps
    JOIN package_templates pt
      ON pt.id = ps.package_template_id
    LEFT JOIN package_variants pv
      ON pv.id = ps.package_variant_id
     AND pv.package_template_id = pt.id
    WHERE ps.id = ? AND ps.business_id = ?
    LIMIT 1
  `).bind(saleId, businessId).first();

  if (!sale) {
    return;
  }

  if (!paid) {
    await env.DB.prepare(`
      UPDATE package_sales
      SET status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? AND status = 'pending'
    `).bind(saleId, businessId).run();
    return;
  }

  if (sale.customer_package_id) {
    await env.DB.prepare(`
      UPDATE package_sales
      SET status = 'paid',
          paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(saleId, businessId).run();
    return;
  }

  const customerPackageId = `cpk_${crypto.randomUUID()}`;
  const validityDays = Number(sale.validity_days || 0);

  await env.DB.prepare(`
    INSERT INTO customer_packages (
      id,
      business_id,
      customer_id,
      package_template_id,
      package_variant_id,
      service_id,
      name_snapshot,
      sessions_total,
      price_minor,
      status,
      starts_on,
      expires_on,
      notes
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
      date('now'),
      CASE
        WHEN ? > 0 THEN date('now', '+' || ? || ' days')
        ELSE NULL
      END,
      'Created automatically from paid package sale'
    )
  `).bind(
    customerPackageId,
    businessId,
    sale.customer_id,
    sale.package_template_id,
    sale.package_variant_id || null,
    sale.service_id,
    sale.name,
    sale.sessions_total,
    Math.max(0, Number(sale.price_minor || 0)),
    validityDays,
    validityDays
  ).run();

  if (sale.payment_id) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO customer_package_payments (
        customer_package_id,
        payment_id
      )
      VALUES (?, ?)
    `).bind(customerPackageId, sale.payment_id).run();
  }

  await env.DB.prepare(`
    UPDATE package_sales
    SET
      status = 'paid',
      customer_package_id = ?,
      paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND business_id = ?
  `).bind(customerPackageId, saleId, businessId).run();
}


async function updatePaymentFromSession({
  env,
  session,
  paid,
  baseUrl = null
}) {

  const paymentId =
    String(
      session?.metadata
        ?.payment_id ||
      ""
    ).trim();


  const businessId =
    String(
      session?.metadata
        ?.business_id ||
      ""
    ).trim();


  if (
    !paymentId ||
    !businessId
  ) {

    return;
  }


  const method =
    String(
      session
        ?.payment_method_types
        ?.[0] ||
      "card"
    );


  if (paid) {

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
            'Stripe Checkout payment confirmed by webhook',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        session.id,
        method,
        paymentId,
        businessId
      )
      .run();


    const customerPackageId =
      String(
        session?.metadata
          ?.customer_package_id ||
        ""
      ).trim();

    if (
      customerPackageId &&
      paymentId
    ) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO customer_package_payments (
          customer_package_id,
          payment_id
        )
        SELECT ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM customer_packages
          WHERE
            id=?
            AND business_id=?
        )
      `).bind(
        customerPackageId,
        paymentId,
        customerPackageId,
        businessId
      ).run();
    }


    await finalizePackageSale({
      env,
      session,
      paid: true
    });


    try {
      await sendPaymentReceipt({
        env,
        businessId,
        paymentId
      });
    } catch (emailError) {
      console.error(
        "Automatic Stripe payment receipt failed:",
        emailError
      );
    }


    const appointmentId =
      String(
        session?.metadata
          ?.appointment_id ||
        ""
      ).trim();


    const isPublicBooking =
      String(
        session?.metadata
          ?.public_booking ||
        ""
      ) === "1";


    if (
      isPublicBooking &&
      appointmentId
    ) {
      await env.DB
        .prepare(`
          UPDATE appointments
          SET
            status = 'confirmed',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
            AND status = 'pending'
        `)
        .bind(
          appointmentId,
          businessId
        )
        .run();


      await sendAppointmentCommunication({
        env,
        businessId,
        appointmentId,
        type:
          "booking_confirmation",
        uniqueKey:
          `booking_confirmation:${appointmentId}`,
        baseUrl
      });

      // A successful public Stripe payment also confirms the appointment.
      // Run booking-confirmed form rules first so consultation forms configured
      // to send on confirmation behave the same for paid and non-paid bookings.
      await runServiceFormAutomation({
        env,
        businessId,
        appointmentId,
        triggerEvent:
          "booking_confirmed",
        baseUrl
      });

      // Preserve payment-specific form automation for businesses that have
      // deliberately configured a form to send when payment is received.
      await runServiceFormAutomation({
        env,
        businessId,
        appointmentId,
        triggerEvent:
          "payment_received",
        baseUrl
      });
    }

  } else {

    await finalizePackageSale({
      env,
      session,
      paid: false
    });

    await env.DB
      .prepare(`
        UPDATE payments

        SET
          status = 'failed',
          provider_reference =
            COALESCE(
              provider_reference,
              ?
            ),
          notes =
            'Stripe Checkout did not complete',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
          AND status = 'pending'
      `)
      .bind(
        session.id ||
        null,
        paymentId,
        businessId
      )
      .run();
  }
}


async function getCheckoutSessionForRefund({
  integration,
  refund
}) {

  let paymentIntentId =
    typeof refund?.payment_intent === "string"
      ? refund.payment_intent
      : refund?.payment_intent?.id || "";


  if (
    !paymentIntentId &&
    refund?.charge
  ) {

    const chargeId =
      typeof refund.charge === "string"
        ? refund.charge
        : refund.charge?.id || "";


    if (chargeId) {

      const chargeResult =
        await stripeRequest({
          secretKey: integration.secretKey,
          path: `/v1/charges/${encodeURIComponent(chargeId)}`
        });


      if (chargeResult.response.ok) {
        paymentIntentId =
          typeof chargeResult.data?.payment_intent === "string"
            ? chargeResult.data.payment_intent
            : chargeResult.data?.payment_intent?.id || "";
      }
    }
  }


  if (!paymentIntentId) {
    return null;
  }


  const result =
    await stripeRequest({
      secretKey: integration.secretKey,
      path:
        `/v1/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntentId)}&limit=1`
    });


  if (!result.response.ok) {
    return null;
  }


  return result.data?.data?.[0] || null;
}


async function refreshOriginalPaymentRefundStatus({
  env,
  businessId,
  paymentId
}) {

  const row =
    await env.DB
      .prepare(`
        SELECT
          p.amount_minor,
          COALESCE(
            (
              SELECT SUM(r.amount_minor)
              FROM payments r
              WHERE
                r.business_id = p.business_id
                AND r.payment_type = 'refund'
                AND r.status = 'paid'
                AND instr(
                  COALESCE(r.notes, ''),
                  ?
                ) > 0
            ),
            0
          ) AS refunded_minor
        FROM payments p
        WHERE
          p.id = ?
          AND p.business_id = ?
        LIMIT 1
      `)
      .bind(
        `original_payment=${paymentId}`,
        paymentId,
        businessId
      )
      .first();


  if (!row) {
    return;
  }


  const amount = Number(row.amount_minor || 0);
  const refunded = Number(row.refunded_minor || 0);

  const status =
    refunded <= 0
      ? "paid"
      : refunded >= amount
        ? "refunded"
        : "partially_refunded";


  await env.DB
    .prepare(`
      UPDATE payments
      SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = ?
        AND business_id = ?
    `)
    .bind(
      status,
      paymentId,
      businessId
    )
    .run();
}


async function updatePaymentFromRefund({
  env,
  integration,
  refund,
  businessId
}) {

  const refundId = String(refund?.id || "").trim();

  if (!refundId) {
    return;
  }


  const session =
    await getCheckoutSessionForRefund({
      integration,
      refund
    });


  const paymentId =
    String(session?.metadata?.payment_id || "").trim();

  const metadataBusinessId =
    String(session?.metadata?.business_id || "").trim();


  if (
    !paymentId ||
    metadataBusinessId !== businessId
  ) {
    return;
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
          currency
        FROM payments
        WHERE
          id = ?
          AND business_id = ?
        LIMIT 1
      `)
      .bind(
        paymentId,
        businessId
      )
      .first();


  if (!original) {
    return;
  }


  const stripeStatus =
    String(refund?.status || "").toLowerCase();

  const localStatus =
    stripeStatus === "succeeded"
      ? "paid"
      : stripeStatus === "failed" || stripeStatus === "canceled"
        ? "failed"
        : "pending";

  const amountMinor =
    Math.max(
      0,
      Number(refund?.amount || 0)
    );

  const localRefundId =
    `stripe_refund_${refundId}`;

  const notes =
    `original_payment=${paymentId} · Stripe refund ${refundId}`;


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
        notes,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, 'stripe', 'refund', ?, ?, ?, ?,
        CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END,
        ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        amount_minor = excluded.amount_minor,
        status = excluded.status,
        paid_at = CASE
          WHEN excluded.status = 'paid'
          THEN COALESCE(payments.paid_at, CURRENT_TIMESTAMP)
          ELSE payments.paid_at
        END,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      localRefundId,
      businessId,
      original.appointment_id || null,
      original.customer_id || null,
      amountMinor,
      String(refund?.currency || original.currency || "GBP").toUpperCase(),
      localStatus,
      refundId,
      localStatus,
      original.payment_method || "card",
      notes
    )
    .run();


  await refreshOriginalPaymentRefundStatus({
    env,
    businessId,
    paymentId
  });
}


export async function onRequestPost({
  request,
  env
}) {

  try {

    const url =
      new URL(
        request.url
      );


    const businessId =
      String(
        url.searchParams.get(
          "business_id"
        ) ||
        ""
      ).trim();


    if (!businessId) {

      return new Response(
        "Missing business_id",
        {
          status: 400
        }
      );
    }


    const integration =
      await getBusinessStripeIntegration(
        env,
        businessId
      );


    if (
      integration.error ||
      !integration.webhookSecret
    ) {

      return new Response(
        "Webhook is not configured",
        {
          status: 503
        }
      );
    }


    const payload =
      await request.text();


    const signatureHeader =
      request.headers.get(
        "Stripe-Signature"
      );


    const valid =
      await verifySignature({
        payload,
        signatureHeader,
        secret:
          integration.webhookSecret
      });


    if (!valid) {

      return new Response(
        "Invalid Stripe signature",
        {
          status: 400
        }
      );
    }


    let event;


    try {

      event =
        JSON.parse(
          payload
        );

    } catch {

      return new Response(
        "Invalid JSON",
        {
          status: 400
        }
      );
    }


    const session =
      event?.data?.object;


    switch (
      event?.type
    ) {

      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":

        if (
          session?.payment_status ===
          "paid"
        ) {

          await updatePaymentFromSession({
            env,
            session,
            paid:
              true,
            baseUrl:
              new URL(
                request.url
              ).origin
          });
        }

        break;


      case "refund.created":
      case "refund.updated":
      case "refund.failed":

        await updatePaymentFromRefund({
          env,
          integration,
          refund: session,
          businessId
        });

        break;


      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":

        await updatePaymentFromSession({
          env,
          session,
          paid:
            false,
          baseUrl:
            new URL(
              request.url
            ).origin
        });

        break;


      default:
        break;
    }


    return new Response(
      "ok",
      {
        status: 200
      }
    );


  } catch (error) {

    console.error(
      "Stripe webhook failed:",
      error
    );


    return new Response(
      "Webhook processing failed",
      {
        status: 500
      }
    );
  }
}
