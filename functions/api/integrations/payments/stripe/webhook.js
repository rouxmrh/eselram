import {
  getBusinessStripeIntegration
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


async function updatePaymentFromSession({
  env,
  session,
  paid
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

  } else {

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
              true
          });
        }

        break;


      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":

        await updatePaymentFromSession({
          env,
          session,
          paid:
            false
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
