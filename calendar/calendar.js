const calendarGrid =
  document.getElementById(
    "calendarGrid"
  );

const calendarMonthTitle =
  document.getElementById(
    "calendarMonthTitle"
  );

const calendarStatus =
  document.getElementById(
    "calendarStatus"
  );

const calendarSummary =
  document.getElementById(
    "calendarSummary"
  );

const calendarBookingDrawer =
  document.getElementById(
    "calendarBookingDrawer"
  );

const calendarDrawerBackdrop =
  document.getElementById(
    "calendarDrawerBackdrop"
  );

const calendarDrawerTitle =
  document.getElementById(
    "calendarDrawerTitle"
  );

const calendarDrawerStatus =
  document.getElementById(
    "calendarDrawerStatus"
  );

const calendarBookingDetails =
  document.getElementById(
    "calendarBookingDetails"
  );

const openBookingsButton =
  document.getElementById(
    "openBookingsButton"
  );


let bookings = [];

const isEmbeddedCalendar =
  window.self !== window.top ||
  new URLSearchParams(window.location.search).get("embedded") === "1";

if (
  isEmbeddedCalendar &&
  openBookingsButton
) {
  openBookingsButton.target = "_top";
}

let currentMonth =
  startOfMonth(
    new Date()
  );


document
  .getElementById(
    "previousMonthButton"
  )
  .addEventListener(
    "click",
    () => {
      currentMonth =
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() - 1,
          1
        );

      renderCalendar();
    }
  );


document
  .getElementById(
    "nextMonthButton"
  )
  .addEventListener(
    "click",
    () => {
      currentMonth =
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1,
          1
        );

      renderCalendar();
    }
  );


document
  .getElementById(
    "todayButton"
  )
  .addEventListener(
    "click",
    () => {
      currentMonth =
        startOfMonth(
          new Date()
        );

      renderCalendar();
    }
  );


document
  .getElementById(
    "closeCalendarDrawer"
  )
  .addEventListener(
    "click",
    closeBookingDrawer
  );


calendarDrawerBackdrop
  .addEventListener(
    "click",
    closeBookingDrawer
  );


document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape" &&
      calendarBookingDrawer
        .classList
        .contains(
          "is-open"
        )
    ) {

      closeBookingDrawer();
    }
  }
);


/* =======================================================
   Load bookings
   ======================================================= */

async function loadBookings() {

  calendarStatus.hidden =
    true;


  try {

    const response =
      await fetch(
        "/api/bookings",
        {
          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );


    if (
      response.status === 401
    ) {

      window.location.href =
        "/auth/login.html";

      return;
    }


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to load calendar."
      );
    }


    bookings =
      data.bookings ||
      [];


    renderCalendar();


  } catch (error) {

    calendarStatus.hidden =
      false;

    calendarStatus.className =
      "es-status error";

    calendarStatus.textContent =
      error.message ||
      "Unable to load calendar.";
  }
}


/* =======================================================
   Calendar
   ======================================================= */

function renderCalendar() {

  calendarMonthTitle.textContent =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        month:
          "long",
        year:
          "numeric"
      }
    ).format(
      currentMonth
    );


  const start =
    calendarGridStart(
      currentMonth
    );


  const cells = [];


  for (
    let index = 0;
    index < 42;
    index += 1
  ) {

    const date =
      addDays(
        start,
        index
      );


    cells.push(
      renderDay(
        date
      )
    );
  }


  calendarGrid.innerHTML =
    cells.join("");


  bindCalendarEvents();

  renderSummary();
}


function renderDay(date) {

  const dateKey =
    toDateKey(
      date
    );


  const dayBookings =
    bookingsForDate(
      dateKey
    );


  const isCurrentMonth =
    date.getMonth() ===
      currentMonth.getMonth() &&
    date.getFullYear() ===
      currentMonth.getFullYear();


  const today =
    toDateKey(
      new Date()
    );


  const jsDay =
    date.getDay();


  const isWeekend =
    jsDay === 0 ||
    jsDay === 6;


  const visibleBookings =
    dayBookings.slice(
      0,
      3
    );


  const hiddenCount =
    dayBookings.length -
    visibleBookings.length;


  return `
    <div
      class="
        es-calendar-day
        ${
          isCurrentMonth
            ? ""
            : "is-outside"
        }
        ${
          dateKey === today
            ? "is-today"
            : ""
        }
        ${
          isWeekend
            ? "is-weekend"
            : ""
        }
      "
      data-date="${dateKey}"
    >

      <div class="es-calendar-day-header">

        <span class="es-calendar-day-number">
          ${date.getDate()}
        </span>

        <button
          class="es-calendar-add"
          type="button"
          data-new-booking-date="${dateKey}"
          aria-label="Create booking on ${escapeHtml(
            formatFullDate(
              date
            )
          )}"
          title="New booking"
        >
          +
        </button>

      </div>


      <div class="es-calendar-events">

        ${
          visibleBookings
            .map(
              (booking) =>
                renderBooking(
                  booking
                )
            )
            .join("")
        }


        ${
          hiddenCount > 0
            ? `
              <div class="es-calendar-more">
                +${hiddenCount} more
              </div>
            `
            : ""
        }

      </div>

    </div>
  `;
}


function renderBooking(
  booking
) {

  const serviceLabel =
    booking.booking_kind === "consultation"
      ? `Consultation · ${booking.service_name}`
      : booking.service_name;

  return `
    <button
      class="
        es-calendar-event
        es-calendar-event-${escapeHtml(
          booking.status ||
          "confirmed"
        )}
      "
      type="button"
      data-booking-id="${escapeHtml(
        booking.id
      )}"
      title="${escapeHtml(
        `${formatTimeFromDateTime(
          booking.start_at
        )} ${booking.first_name} ${booking.last_name} — ${serviceLabel}`
      )}"
    >

      <strong>
        ${formatTimeFromDateTime(
          booking.start_at
        )}
      </strong>

      <span class="es-calendar-event-customer">
        ${escapeHtml(
          `${booking.first_name} ${booking.last_name}`
        )}
      </span>

      <span class="es-calendar-event-service">
        ${escapeHtml(
          serviceLabel
        )}
      </span>

    </button>
  `;
}


function bindCalendarEvents() {

  document
    .querySelectorAll(
      "[data-booking-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();


            const booking =
              bookings.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .bookingId
              );


            if (booking) {

              showBookingDetails(
                booking
              );
            }
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-new-booking-date]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();

            openNewBooking(
              button.dataset
                .newBookingDate
            );
          }
        );
      }
    );


  document
    .querySelectorAll(
      ".es-calendar-day"
    )
    .forEach(
      (day) => {

        day.addEventListener(
          "dblclick",
          () =>
            openNewBooking(
              day.dataset.date
            )
        );
      }
    );
}


/* =======================================================
   Booking drawer
   ======================================================= */

function showBookingDetails(
  booking
) {

  calendarDrawerTitle.textContent =
    `${booking.first_name} ${booking.last_name}`;


  calendarDrawerStatus.textContent =
    formatStatus(
      booking.status
    );


  calendarDrawerStatus.className =
    `es-calendar-drawer-status ${
      booking.status ||
      ""
    }`;


  calendarBookingDetails.innerHTML = `
    ${detailItem(
      "Service",
      booking.service_name
    )}

    ${detailItem(
      "Date",
      formatFullDate(
        parseDateTime(
          booking.start_at
        )
      )
    )}

    ${detailItem(
      "Time",
      `${formatTimeFromDateTime(
        booking.start_at
      )} – ${formatTimeFromDateTime(
        booking.end_at
      )}`
    )}

    ${detailItem(
      "Price",
      formatMoney(
        booking.price_minor
      )
    )}

    ${
      Number(booking.consultation_credit_minor || 0) > 0
        ? detailItem(
            "Consultation credit",
            formatMoney(booking.consultation_credit_minor)
          )
        : Number(booking.deposit_due_minor || 0) > 0
          ? detailItem(
              "Deposit",
              formatMoney(booking.deposit_due_minor)
            )
          : ""
    }

    ${detailItem(
      "Remaining balance",
      formatMoney(
        Math.max(
          Number(booking.price_minor || 0) -
          Number(booking.paid_minor || 0) -
          Number(booking.consultation_credit_minor || 0),
          0
        )
      )
    )}

    ${detailItem(
      "Email",
      booking.email ||
      "—"
    )}

    ${detailItem(
      "Phone",
      booking.phone ||
      "—"
    )}

    ${detailItem(
      "Notes",
      booking.notes ||
      "No notes",
      true
    )}
  `;


  openBookingsButton.href =
    `/bookings/?booking=${encodeURIComponent(
      booking.id
    )}`;


  calendarBookingDrawer
    .classList
    .add(
      "is-open"
    );


  calendarDrawerBackdrop
    .classList
    .add(
      "is-open"
    );


  calendarBookingDrawer
    .setAttribute(
      "aria-hidden",
      "false"
    );
}


function closeBookingDrawer() {

  calendarBookingDrawer
    .classList
    .remove(
      "is-open"
    );


  calendarDrawerBackdrop
    .classList
    .remove(
      "is-open"
    );


  calendarBookingDrawer
    .setAttribute(
      "aria-hidden",
      "true"
    );
}


function detailItem(
  label,
  value,
  full = false
) {

  return `
    <div
      class="
        es-calendar-detail
        ${
          full
            ? "es-calendar-detail-full"
            : ""
        }
      "
    >

      <span>
        ${escapeHtml(
          label
        )}
      </span>

      <strong>
        ${escapeHtml(
          value ??
          "—"
        )}
      </strong>

    </div>
  `;
}


/* =======================================================
   Summary
   ======================================================= */

function renderSummary() {

  const monthBookings =
    bookings.filter(
      (booking) => {

        const date =
          parseDateTime(
            booking.start_at
          );


        return (
          date.getFullYear() ===
            currentMonth.getFullYear() &&
          date.getMonth() ===
            currentMonth.getMonth()
        );
      }
    );


  const confirmed =
    monthBookings.filter(
      (booking) =>
        booking.status ===
        "confirmed"
    ).length;


  const completed =
    monthBookings.filter(
      (booking) =>
        booking.status ===
        "completed"
    ).length;


  const cancelled =
    monthBookings.filter(
      (booking) =>
        booking.status ===
        "cancelled"
    ).length;


  calendarSummary.innerHTML = `
    <span class="es-calendar-summary-pill">
      <strong>
        ${monthBookings.length}
      </strong>
      total
    </span>

    <span class="es-calendar-summary-pill confirmed">
      <strong>
        ${confirmed}
      </strong>
      confirmed
    </span>

    <span class="es-calendar-summary-pill completed">
      <strong>
        ${completed}
      </strong>
      completed
    </span>

    <span class="es-calendar-summary-pill cancelled">
      <strong>
        ${cancelled}
      </strong>
      cancelled
    </span>
  `;
}


/* =======================================================
   New booking
   ======================================================= */

function openNewBooking(
  date
) {

  const destination =
    `/bookings/?date=${encodeURIComponent(
      date
    )}`;

  if (
    isEmbeddedCalendar &&
    window.top
  ) {

    window.top.location.href =
      destination;

    return;
  }

  window.location.href =
    destination;
}


/* =======================================================
   Date helpers
   ======================================================= */

function startOfMonth(date) {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}


function calendarGridStart(
  month
) {

  const first =
    startOfMonth(
      month
    );


  const jsDay =
    first.getDay();


  const mondayIndex =
    jsDay === 0
      ? 6
      : jsDay - 1;


  return addDays(
    first,
    -mondayIndex
  );
}


function addDays(
  date,
  amount
) {

  const result =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );


  result.setDate(
    result.getDate() +
    amount
  );


  return result;
}


function toDateKey(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


function parseDateTime(value) {

  return new Date(
    String(value)
  );
}


function dateKeyFromDateTime(
  value
) {

  return toDateKey(
    parseDateTime(
      value
    )
  );
}


function bookingsForDate(
  dateKey
) {

  return bookings
    .filter(
      (booking) =>
        dateKeyFromDateTime(
          booking.start_at
        ) === dateKey
    )
    .sort(
      (a, b) =>
        parseDateTime(
          a.start_at
        ) -
        parseDateTime(
          b.start_at
        )
    );
}


/* =======================================================
   Formatters
   ======================================================= */

function formatTimeFromDateTime(
  value
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  ).format(
    parseDateTime(
      value
    )
  );
}


function formatFullDate(date) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday:
        "long",
      day:
        "numeric",
      month:
        "long",
      year:
        "numeric"
    }
  ).format(date);
}


function formatMoney(
  amountMinor
) {

  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",
      currency:
        "GBP"
    }
  ).format(
    Number(
      amountMinor ||
      0
    ) / 100
  );
}


function formatStatus(value) {

  const statuses = {
    confirmed:
      "Confirmed",
    completed:
      "Completed",
    cancelled:
      "Cancelled",
    pending:
      "Pending"
  };


  return statuses[value] ||
    value ||
    "—";
}


function escapeHtml(value) {

  return String(
    value ??
    ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =======================================================
   Start
   ======================================================= */

loadBookings();
