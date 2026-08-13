import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  decryptIntegrationSecret
} from "../../../lib/integration-crypto.js";


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
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
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


function parseJson(
  value,
  fallback = {}
) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(
      value
    );
  } catch {
    return fallback;
  }
}


function escapeHtml(
  value
) {
  return String(
    value ??
    ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function money(
  minor,
  currency = "GBP"
) {
  try {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style:
          "currency",
        currency:
          String(
            currency ||
            "GBP"
          ).toUpperCase()
      }
    ).format(
      Number(
        minor ||
        0
      ) /
      100
    );
  } catch {
    return `${currency} ${(
      Number(minor || 0) /
      100
    ).toFixed(2)}`;
  }
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
      !appointmentId ||
      !paymentId ||
      !checkoutUrl
    ) {
      return badRequest(
        "Appointment, payment and checkout link are required."
      );
    }

    let parsedUrl;

    try {
      parsedUrl =
        new URL(
          checkoutUrl
        );
    } catch {
      return badRequest(
        "The Stripe Checkout link is invalid."
      );
    }

    if (
      parsedUrl.protocol !==
        "https:" ||
      parsedUrl.hostname !==
        "checkout.stripe.com"
    ) {
      return badRequest(
        "Only secure Stripe Checkout links can be emailed."
      );
    }

    const row =
      await env.DB
        .prepare(`
          SELECT
            p.id AS payment_id,
            p.amount_minor,
            p.currency,
            p.status AS payment_status,
            p.provider,

            a.id AS appointment_id,
            a.booking_kind,

            c.id AS customer_id,
            c.first_name,
            c.last_name,
            c.email,

            s.name AS service_name,

            b.id AS business_id,
            b.name AS business_name,

            bb.primary_colour,
            bb.background_colour,
            bb.surface_colour,
            bb.text_colour

          FROM payments p

          JOIN appointments a
            ON a.id =
               p.appointment_id

          JOIN customers c
            ON c.id =
               p.customer_id

          JOIN services s
            ON s.id =
               a.service_id

          JOIN businesses b
            ON b.id =
               p.business_id

          LEFT JOIN business_branding bb
            ON bb.business_id =
               b.id

          WHERE
            p.id = ?
            AND p.appointment_id = ?
            AND p.business_id = ?

          LIMIT 1
        `)
        .bind(
          paymentId,
          appointmentId,
          user.business_id
        )
        .first();

    if (!row) {
      return badRequest(
        "The payment link could not be matched to this booking."
      );
    }

    if (
      row.provider !==
        "stripe" ||
      row.payment_status !==
        "pending"
    ) {
      return badRequest(
        "Only a pending Stripe payment link can be emailed."
      );
    }

    const recipient =
      String(
        row.email ||
        ""
      )
        .trim()
        .toLowerCase();

    if (!recipient) {
      return badRequest(
        "This customer does not have an email address."
      );
    }

    const integration =
      await env.DB
        .prepare(`
          SELECT
            encrypted_credentials,
            config_json,
            status

          FROM business_integrations

          WHERE
            business_id = ?
            AND integration_type =
                'email'
            AND provider =
                'resend'

          LIMIT 1
        `)
        .bind(
          user.business_id
        )
        .first();

    if (
      !integration ||
      !integration.encrypted_credentials ||
      ![
        "verified",
        "configured"
      ].includes(
        String(
          integration.status ||
          ""
        )
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email integration is not connected."
        },
        {
          status: 503
        }
      );
    }

    const credentials =
      parseJson(
        await decryptIntegrationSecret(
          integration.encrypted_credentials,
          env.ESELRAM_ENCRYPTION_KEY
        )
      );

    const config =
      parseJson(
        integration.config_json
      );

    const apiKey =
      String(
        credentials.api_key ||
        ""
      ).trim();

    const fromName =
      String(
        config.from_name ||
        ""
      ).trim();

    const fromEmail =
      String(
        config.from_email ||
        ""
      ).trim();

    if (
      !apiKey ||
      !fromName ||
      !fromEmail
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email integration is incomplete."
        },
        {
          status: 503
        }
      );
    }

    const serviceName =
      row.booking_kind ===
        "consultation"
        ? `Consultation · ${
            row.service_name
          }`
        : row.service_name;

    const amountText =
      money(
        row.amount_minor,
        row.currency
      );

    const subject =
      `Payment link · ${serviceName}`;

    const communicationId =
      `com_${
        crypto.randomUUID()
      }`;

    await env.DB
      .prepare(`
        INSERT INTO customer_communications (
          id,
          business_id,
          appointment_id,
          customer_id,
          payment_id,
          communication_type,
          recipient,
          subject,
          status,
          provider,
          unique_key
        )
        VALUES (
          ?, ?, ?, ?, ?,
          'payment_link',
          ?, ?,
          'pending',
          'resend',
          ?
        )
      `)
      .bind(
        communicationId,
        user.business_id,
        appointmentId,
        row.customer_id,
        paymentId,
        recipient,
        subject,
        `payment_link:${
          paymentId
        }:${
          crypto.randomUUID()
        }`
      )
      .run();

    const primary =
      String(
        row.primary_colour ||
        "#365c50"
      );

    const surface =
      String(
        row.surface_colour ||
        "#ffffff"
      );

    const background =
      String(
        row.background_colour ||
        "#f5f4ef"
      );

    const text =
      String(
        row.text_colour ||
        "#202a26"
      );

    const customerName =
      String(
        row.first_name ||
        "there"
      );

    const html = `
      <div style="margin:0;padding:32px;background:${escapeHtml(background)};font-family:Arial,sans-serif;color:${escapeHtml(text)}">
        <div style="max-width:560px;margin:0 auto;background:${escapeHtml(surface)};border-radius:16px;padding:28px">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.12em">Secure payment</p>
          <h1 style="margin:0 0 18px;font-size:26px">Payment link</h1>
          <p>Hi ${escapeHtml(customerName)},</p>
          <p>${escapeHtml(row.business_name)} has sent you a secure payment link for <strong>${escapeHtml(serviceName)}</strong>.</p>
          <p><strong>Amount due: ${escapeHtml(amountText)}</strong></p>
          <p style="margin:26px 0">
            <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background:${escapeHtml(primary)};color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">
              Pay securely
            </a>
          </p>
          <p style="font-size:13px;opacity:.75">Payment is processed securely by Stripe. If you have already paid, you can ignore this email.</p>
        </div>
      </div>
    `;

    const textBody = [
      `Hi ${customerName},`,
      "",
      `${row.business_name} has sent you a secure payment link for ${serviceName}.`,
      `Amount due: ${amountText}`,
      "",
      checkoutUrl,
      "",
      "Payment is processed securely by Stripe."
    ].join("\n");

    try {
      const response =
        await fetch(
          "https://api.resend.com/emails",
          {
            method:
              "POST",
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                from:
                  `${fromName} <${fromEmail}>`,
                to: [
                  recipient
                ],
                subject,
                html,
                text:
                  textBody
              })
          }
        );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          String(
            data?.message ||
            data?.error ||
            "Resend rejected the email."
          )
        );
      }

      await env.DB
        .prepare(`
          UPDATE customer_communications
          SET
            status = 'sent',
            provider_reference = ?,
            sent_at =
              CURRENT_TIMESTAMP,
            error_details = NULL,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          data?.id ||
          null,
          communicationId
        )
        .run();

      return Response.json({
        ok: true,
        recipient
      });
    } catch (error) {
      await env.DB
        .prepare(`
          UPDATE customer_communications
          SET
            status = 'failed',
            error_details = ?,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          String(
            error?.message ||
            "Unable to send payment link."
          ).slice(
            0,
            1000
          ),
          communicationId
        )
        .run();

      return Response.json(
        {
          ok: false,
          error:
            error?.message ||
            "Unable to send payment link."
        },
        {
          status: 502
        }
      );
    }
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
