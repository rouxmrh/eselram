import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

import {
  runDueReminders,
  getCommunicationSettings,
  sendAppointmentCommunication
} from "../../../lib/communications.js";

import {
  runDueFormReminders
} from "../../../lib/form-automation.js";

async function getUserContext(request, env) {
  const token =
    readSessionToken(request);

  if (!token) return null;

  const tokenHash =
    await hashSessionToken(token);

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
    .bind(tokenHash)
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

    const rows =
      await env.DB
        .prepare(`
          SELECT
            cc.id,
            cc.appointment_id,
            cc.customer_id,
            cc.communication_type,
            cc.recipient,
            cc.subject,
            cc.status,
            cc.provider,
            cc.provider_reference,
            cc.sent_at,
            cc.error_details,
            cc.created_at,
            cc.payment_id,
            cc.form_request_id,
            cc.customer_package_id,

            c.first_name,
            c.last_name,

            CASE
              WHEN a.booking_kind = 'consultation'
                THEN 'Consultation · ' || s.name
              ELSE s.name
            END AS service_name,
            a.start_at,

            p.amount_minor AS payment_amount_minor,
            p.currency AS payment_currency,

            cp.name_snapshot AS package_name,

            ct.name AS form_name

          FROM customer_communications cc

          LEFT JOIN customers c
            ON c.id =
               cc.customer_id

          LEFT JOIN appointments a
            ON a.id =
               cc.appointment_id

          LEFT JOIN services s
            ON s.id =
               a.service_id

          LEFT JOIN payments p
            ON p.id =
               cc.payment_id

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

          ORDER BY
            datetime(
              COALESCE(
                cc.sent_at,
                cc.created_at
              )
            ) DESC

          LIMIT 200
        `)
        .bind(
          user.business_id
        )
        .all();

    const settings =
      await getCommunicationSettings(
        env,
        user.business_id
      );

    return Response.json({
      ok: true,
      communications:
        rows.results ||
        [],
      settings
    });
  } catch (error) {
    console.error(
      "Communications GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load communications."
      },
      {
        status: 500
      }
    );
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

    if (
      body.action ===
      "resend_aftercare"
    ) {
      const communicationId =
        String(
          body.communication_id ||
          ""
        ).trim();

      if (!communicationId) {
        return Response.json(
          {
            ok: false,
            error:
              "Communication id is required."
          },
          { status: 400 }
        );
      }

      const communication =
        await env.DB
          .prepare(`
            SELECT
              id,
              appointment_id,
              communication_type,
              status,
              unique_key
            FROM customer_communications
            WHERE
              id = ?
              AND business_id = ?
            LIMIT 1
          `)
          .bind(
            communicationId,
            user.business_id
          )
          .first();

      if (!communication) {
        return Response.json(
          {
            ok: false,
            error:
              "Communication not found."
          },
          { status: 404 }
        );
      }

      if (
        communication.communication_type !==
        "treatment_aftercare"
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "Only treatment aftercare emails can be resent here."
          },
          { status: 400 }
        );
      }

      if (
        communication.status !==
        "failed"
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "Only failed aftercare emails can be resent."
          },
          { status: 409 }
        );
      }

      if (!communication.appointment_id) {
        return Response.json(
          {
            ok: false,
            error:
              "This aftercare email is not linked to a booking."
          },
          { status: 400 }
        );
      }

      const result =
        await sendAppointmentCommunication({
          env,
          businessId:
            user.business_id,
          appointmentId:
            communication.appointment_id,
          type:
            "treatment_aftercare",
          uniqueKey:
            communication.unique_key ||
            `treatment_aftercare:${communication.appointment_id}`,
          baseUrl:
            new URL(
              request.url
            ).origin
        });

      if (!result.ok) {
        return Response.json(
          {
            ok: false,
            error:
              result.error ||
              "Unable to resend aftercare email."
          },
          { status: 502 }
        );
      }

      if (result.skipped) {
        return Response.json(
          {
            ok: false,
            error:
              result.reason === "no_email"
                ? "The customer does not have an email address."
                : "Aftercare could not be resent for this booking."
          },
          { status: 400 }
        );
      }

      return Response.json({
        ok: true,
        resent: true,
        provider_id:
          result.provider_id ||
          null
      });
    }

    if (
      body.action !==
      "run_reminders"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid communications action."
        },
        {
          status: 400
        }
      );
    }

    const appointmentResult =
      await runDueReminders({
        env,
        businessId:
          user.business_id
      });

    const formResult =
      await runDueFormReminders({
        env,
        businessId:
          user.business_id,
        baseUrl:
          new URL(
            request.url
          ).origin
      });

    return Response.json({
      ok: true,
      checked:
        Number(
          appointmentResult.checked ||
          0
        ) +
        Number(
          formResult.checked ||
          0
        ),
      sent:
        Number(
          appointmentResult.sent ||
          0
        ) +
        Number(
          formResult.sent ||
          0
        ),
      failed:
        Number(
          appointmentResult.failed ||
          0
        ) +
        Number(
          formResult.failed ||
          0
        ),
      appointment_reminders:
        appointmentResult,
      form_reminders:
        formResult
    });
  } catch (error) {
    console.error(
      "Manual reminder run failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to run reminders."
      },
      {
        status: 500
      }
    );
  }
}
