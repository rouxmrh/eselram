import {
  runDueReminders
} from "../../../lib/communications.js";

import {
  runDueFormReminders
} from "../../../lib/form-automation.js";

function safeEqual(a, b) {
  const left =
    String(a || "");

  const right =
    String(b || "");

  if (
    !left ||
    left.length !== right.length
  ) {
    return false;
  }

  let result = 0;

  for (
    let i = 0;
    i < left.length;
    i += 1
  ) {
    result |=
      left.charCodeAt(i) ^
      right.charCodeAt(i);
  }

  return result === 0;
}

export async function onRequestPost({
  request,
  env
}) {
  try {
    const expected =
      String(
        env.ESELRAM_CRON_SECRET ||
        ""
      ).trim();

    const auth =
      String(
        request.headers.get(
          "Authorization"
        ) ||
        ""
      );

    const supplied =
      auth.startsWith(
        "Bearer "
      )
        ? auth.slice(7)
        : "";

    if (
      !expected ||
      !safeEqual(
        supplied,
        expected
      )
    ) {
      return new Response(
        "Unauthorized",
        {
          status: 401
        }
      );
    }

    const appointmentResult =
      await runDueReminders({
        env
      });

    const formResult =
      await runDueFormReminders({
        env,
        baseUrl:
          env.ESELRAM_BASE_URL ||
          null
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
      "Reminder scheduler failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to run reminder scheduler."
      },
      {
        status: 500
      }
    );
  }
}
