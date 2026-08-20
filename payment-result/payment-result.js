(async function () {
  "use strict";

  const params =
    new URLSearchParams(
      window.location.search
    );

  const status =
    params.get("status") ===
      "cancelled"
      ? "cancelled"
      : "success";

  const business =
    String(
      params.get("business") ||
      "the business"
    ).trim();

  const website =
    safeWebsite(
      params.get("website")
    );

  const packageSaleId =
    String(
      params.get(
        "package_sale_id"
      ) ||
      ""
    ).trim();

  const sessionId =
    String(
      params.get(
        "session_id"
      ) ||
      ""
    ).trim();

  const mark =
    document.getElementById(
      "resultMark"
    );

  const eyebrow =
    document.getElementById(
      "resultEyebrow"
    );

  const title =
    document.getElementById(
      "resultTitle"
    );

  const message =
    document.getElementById(
      "resultMessage"
    );

  const button =
    document.getElementById(
      "returnButton"
    );


  if (
    status !== "cancelled" &&
    packageSaleId &&
    sessionId
  ) {
    eyebrow.textContent =
      "Confirming payment";

    title.textContent =
      "Finishing your package";

    message.textContent =
      "Your Stripe payment was received. We are activating your package now.";

    try {
      const response =
        await fetch(
          `/api/package-payment/confirm?sale_id=${encodeURIComponent(
            packageSaleId
          )}&session_id=${encodeURIComponent(
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
        !data.ok ||
        data.paid !== true
      ) {
        throw new Error(
          data.error ||
          "Package confirmation is still processing."
        );
      }
    } catch (error) {
      console.error(
        "Package payment confirmation fallback failed:",
        error
      );
    }
  }


  if (
    status !== "cancelled" &&
    sessionId &&
    !packageSaleId
  ) {
    eyebrow.textContent = "Confirming payment";
    title.textContent = "Finishing your payment";
    message.textContent = "Your Stripe payment was received. We are confirming it now.";

    try {
      const response = await fetch(
        `/api/payments/stripe/status?session_id=${encodeURIComponent(sessionId)}`,
        { headers:{Accept:"application/json"}, cache:"no-store" }
      );
      const data = await response.json();
      if (!response.ok || !data.ok || data.payment?.status !== "paid") {
        throw new Error(data.error || "Payment confirmation is still processing.");
      }
    } catch (error) {
      console.error("Payment confirmation fallback failed:", error);
    }
  }


  if (
    status ===
    "cancelled"
  ) {
    mark.textContent =
      "×";

    eyebrow.textContent =
      "Payment cancelled";

    title.textContent =
      "No payment was taken";

    message.textContent =
      "The payment was cancelled. You can safely close this page or return to the business.";

  } else {
    mark.textContent =
      "✓";

    eyebrow.textContent =
      "Payment complete";

    title.textContent =
      "Thank you for your payment";

    message.textContent =
      website
        ? `Payment received. Returning you to ${business}...`
        : "Payment received successfully.";
  }


  if (
    website
  ) {
    button.hidden =
      false;

    button.href =
      website;

    button.textContent =
      `Return to ${
        business
      }`;

    if (
      status !==
      "cancelled"
    ) {
      window.setTimeout(
        () => {
          try { window.close(); } catch {}
          window.setTimeout(() => {
            if (!document.hidden) {
              window.location.replace(website);
            }
          }, 250);
        },
        3000
      );
    }
  }


  if (!website && status !== "cancelled") {
    window.setTimeout(() => {
      try { window.close(); } catch {}
    }, 3000);
  }


  function safeWebsite(
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

    try {
      const parsed =
        new URL(
          raw
        );

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

    } catch {
      return "";
    }
  }
})();
