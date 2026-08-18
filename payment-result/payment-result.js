(function () {
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
          window.location.replace(
            website
          );
        },
        2000
      );
    }
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
