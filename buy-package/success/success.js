const params =
  new URLSearchParams(
    location.search
  );

const saleId =
  params.get(
    "sale_id"
  );

let paidSale = null;

const dateInput =
  document.querySelector(
    "#packageBookingDate"
  );

const timeSelect =
  document.querySelector(
    "#packageBookingTime"
  );

const bookingPanel =
  document.querySelector(
    "#packageBooking"
  );

const bookingStatus =
  document.querySelector(
    "#packageBookingStatus"
  );


async function check(
  attempt = 0
) {
  if (!saleId) {
    document.querySelector(
      "#title"
    ).textContent =
      "Purchase not found";

    document.querySelector(
      "#message"
    ).textContent =
      "The package purchase reference is missing.";

    return;
  }

  try {
    const response =
      await fetch(
        `/api/public-packages/status?sale_id=${encodeURIComponent(
          saleId
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
        "Unable to check purchase."
      );
    }

    if (
      data.sale.status ===
      "paid"
    ) {
      paidSale =
        data.sale;

      document.querySelector(
        "#title"
      ).textContent =
        "Package purchased";

      document.querySelector(
        "#message"
      ).textContent =
        `${data.sale.package_name} has been added to your customer record.`;

      bookingPanel.hidden =
        false;

      const today =
        new Date();

      dateInput.min =
        [
          today.getFullYear(),
          String(
            today.getMonth() +
            1
          ).padStart(
            2,
            "0"
          ),
          String(
            today.getDate()
          ).padStart(
            2,
            "0"
          )
        ].join("-");

      return;
    }

    if (
      data.sale.status ===
        "failed" ||
      data.sale.status ===
        "cancelled"
    ) {
      document.querySelector(
        "#title"
      ).textContent =
        "Payment not completed";

      document.querySelector(
        "#message"
      ).textContent =
        "Your package has not been activated.";

      return;
    }

    if (
      attempt <
      10
    ) {
      setTimeout(
        () =>
          check(
            attempt +
            1
          ),
        1500
      );

      return;
    }

    document.querySelector(
      "#title"
    ).textContent =
      "Payment is processing";

    document.querySelector(
      "#message"
    ).textContent =
      "Your payment is still being confirmed. The package will appear once confirmation is received.";
  } catch (error) {
    document.querySelector(
      "#title"
    ).textContent =
      "Checking payment";

    document.querySelector(
      "#message"
    ).textContent =
      error.message;
  }
}


dateInput
  ?.addEventListener(
    "change",
    async () => {
      const date =
        dateInput.value;

      timeSelect.innerHTML =
        `<option value="">Checking availability…</option>`;

      bookingStatus.textContent =
        "";

      if (!date) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/public-packages/availability?sale_id=${encodeURIComponent(
              saleId
            )}&date=${encodeURIComponent(
              date
            )}`,
            {
              headers: {
                Accept:
                  "application/json"
              }
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
            "Unable to load available times."
          );
        }

        if (
          !(data.slots || [])
            .length
        ) {
          timeSelect.innerHTML =
            `<option value="">No times available</option>`;

          bookingStatus.textContent =
            data.reason ||
            "No times are available on this date.";

          return;
        }

        timeSelect.innerHTML =
          `<option value="">Choose a time</option>` +
          data.slots
            .map(
              (time) =>
                `<option value="${time}">${time}</option>`
            )
            .join("");
      } catch (error) {
        timeSelect.innerHTML =
          `<option value="">Unable to load times</option>`;

        bookingStatus.textContent =
          error.message;
      }
    }
  );


document
  .querySelector(
    "#bookPackageSession"
  )
  ?.addEventListener(
    "click",
    async () => {
      const date =
        dateInput.value;

      const time =
        timeSelect.value;

      if (
        !date ||
        !time
      ) {
        bookingStatus.textContent =
          "Choose a date and time first.";

        return;
      }

      bookingStatus.textContent =
        "Booking your first session…";

      try {
        const response =
          await fetch(
            "/api/public-packages/book-session",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json"
              },
              body:
                JSON.stringify({
                  sale_id:
                    saleId,
                  date,
                  time
                })
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
            "Unable to book the package session."
          );
        }

        bookingStatus.textContent =
          `${data.booking.service_name} is booked for ${date} at ${time}. This session is covered by your package.`;

        document.querySelector(
          "#bookPackageSession"
        ).disabled =
          true;

        dateInput.disabled =
          true;

        timeSelect.disabled =
          true;
      } catch (error) {
        bookingStatus.textContent =
          error.message;
      }
    }
  );


check();
