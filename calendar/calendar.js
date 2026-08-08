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

const calendarBookingDialog =
  document.getElementById(
    "calendarBookingDialog"
  );

const calendarDialogTitle =
  document.getElementById(
    "calendarDialogTitle"
  );

const calendarBookingDetails =
  document.getElementById(
    "calendarBookingDetails"
  );


let bookings = [];

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
    "closeCalendarDialog"
  )
  .addEventListener(
    "click",
    () =>
      calendarBookingDialog.close()
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
      class="es-calendar-day
        ${
          isCurrentMonth
            ? ""
            : "is-outside"
        }
        ${
          dateKey === today
            ? "is-today"
            : ""
        }"
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
        )} ${booking.first_name} ${booking.last_name} — ${booking.service_name}`
      )}"
    >

      <strong>
        ${formatTimeFromDateTime(
          booking.start_at
        )}
        ·
        ${escapeHtml(
          booking.first_name
        )}
      </strong>

      <span>
        ${escapeHtml(
          booking.service_name
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
   Booking details
   ======================================================= */

function showBookingDetails(
  booking
) {

  calendarDialogTitle.textContent =
    `${booking.first_name} ${booking.last_name}`;


  calendarBookingDetails.innerHTML = `
    ${detailItem(
      "Service",
      booking.service_name
    )}

    ${detailItem(
      "Status",
      formatStatus(
        booking.status
      )
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

    ${detailItem(
      "Deposit due",
      formatMoney(
        booking.deposit_due_minor
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


  if (
    typeof calendarBookingDialog
      .showModal ===
    "function"
  ) {

    calendarBookingDialog.showModal();
  }
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
    <span>
      <strong>
        ${monthBookings.length}
      </strong>
      booking${
        monthBookings.length === 1
          ? ""
          : "s"
      }
    </span>

    <span>
      <strong>
        ${confirmed}
      </strong>
      confirmed
    </span>

    <span>
      <strong>
        ${completed}
      </strong>
      completed
    </span>

    <span>
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

  /*
    The date is included in the URL now.
    The Bookings page can use it as a
    preselected date when we wire that
    small enhancement into bookings.js.
  */

  window.location.href =
    `/bookings/?date=${encodeURIComponent(
      date
    )}`;
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

