const title =
  document.getElementById(
    "paymentTitle"
  );

const message =
  document.getElementById(
    "paymentMessage"
  );

const statusBox =
  document.getElementById(
    "paymentStatus"
  );


async function verifyPayment() {

  const url =
    new URL(
      window.location.href
    );


  const sessionId =
    String(
      url.searchParams.get(
        "session_id"
      ) ||
      ""
    );


  if (!sessionId) {

    title.textContent =
      "Payment status unavailable";

    message.textContent =
      "The payment reference is missing.";

    return;
  }


  try {

    const response =
      await fetch(
        `/api/payments/stripe/status?session_id=${encodeURIComponent(
          sessionId
        )}`,
        {
          headers: {
            Accept:
              "application/json"
          },
          cache:
            "no-store"
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to verify payment."
      );
    }


    if (
      data.payment.status ===
      "paid"
    ) {

      title.textContent =
        "Thank you — payment received";

      message.textContent =
        "Your payment has been confirmed successfully.";

      statusBox.hidden =
        false;

      statusBox.className =
        "es-status success";

      statusBox.textContent =
        `${formatMoney(
          data.payment.amount_minor,
          data.payment.currency
        )} paid successfully.`;

      return;
    }


    title.textContent =
      "Payment is processing";

    message.textContent =
      "Stripe has returned you to the booking system, but the payment has not been marked paid yet.";

    statusBox.hidden =
      false;

    statusBox.className =
      "es-status";

    statusBox.textContent =
      "Please check again shortly.";

  } catch (error) {

    title.textContent =
      "We could not confirm the payment yet";

    message.textContent =
      "If payment was completed, the business can still receive Stripe's payment confirmation automatically.";

    statusBox.hidden =
      false;

    statusBox.className =
      "es-status error";

    statusBox.textContent =
      error.message ||
      "Unable to verify payment.";
  }
}


function formatMoney(
  amountMinor,
  currency
) {

  return new Intl
    .NumberFormat(
      undefined,
      {
        style:
          "currency",
        currency:
          currency ||
          "GBP"
      }
    )
    .format(
      Number(
        amountMinor ||
        0
      ) /
      100
    );
}


verifyPayment();
