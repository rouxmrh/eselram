import {
  runDueReminders
} from "../../../lib/communications.js";

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

    const result =
      await runDueReminders({
        env
      });

    return Response.json({
      ok: true,
      ...result
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
