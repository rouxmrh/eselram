const formPanel =
  document.getElementById(
    "bookingFormPanel"
  );

const form =
  document.getElementById(
    "bookingForm"
  );

const serviceSelect =
  document.getElementById(
    "serviceSelect"
  );

const bookingDate =
  document.getElementById(
    "bookingDate"
  );

const timeSelect =
  document.getElementById(
    "timeSelect"
  );

const availabilityStatus =
  document.getElementById(
    "availabilityStatus"
  );

const bookingStatus =
  document.getElementById(
    "bookingStatus"
  );

const saveBookingButton =
  document.getElementById(
    "saveBookingButton"
  );

const bookingsList =
  document.getElementById(
    "bookingsList"
  );

const bookingSearch =
  document.getElementById(
    "bookingSearch"
  );

const bookingStatusFilter =
  document.getElementById(
    "bookingStatusFilter"
  );


let services = [];
let bookings = [];


/* =======================================================
   Initial setup
   ======================================================= */

document
  .getElementById(
    "newBookingButton"
  )
  .addEventListener(
    "click",
    openBookingForm
  );


document
  .getElementById(
    "cancelBookingButton"
  )
  .addEventListener(
    "click",
    closeBookingForm
  );


serviceSelect.addEventListener(
  "change",
  loadAvailability
);


bookingDate.addEventListener(
  "change",
  loadAvailability
);


bookingSearch.addEventListener(
  "input",
  renderBookings
);


bookingStatusFilter.addEventListener(
  "change",
  renderBookings
);


function setMinimumDate() {

  const today =
    new Date();

  const yyyy =
    today.getFullYear();

  const mm =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const dd =
    String(
      today.getDate()
    ).padStart(2, "0");

  bookingDate.min =
    `${yyyy}-${mm}-${dd}`;
}


/* =======================================================
   Services
   ======================================================= */

async function loadServices() {

  try {

    const response =
      await fetch(
        "/api/services",
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
        "Unable to load services."
      );
    }


    services =
      (data.services || [])
        .filter(
          (service) =>
            service.is_active === 1
        );


    if (
      services.length === 0
    ) {

      serviceSelect.innerHTML = `
        <option value="">
          No active services available
        </option>
      `;

      serviceSelect.disabled =
        true;

      return;
    }


    serviceSelect.disabled =
      false;


    serviceSelect.innerHTML = `
      <option value="">
        Choose a service
      </option>

      ${
        services
          .map(
            (service) => `
              <option
                value="${escapeHtml(
                  service.id
                )}"
              >
                ${escapeHtml(
                  service.name
                )}
                ·
                ${service.duration_minutes} min
                ·
                ${formatMoney(
                  service.price_minor
                )}
              </option>
            `
          )
          .join("")
      }
    `;


  } catch (error) {

    serviceSelect.innerHTML = `
      <option value="">
        Unable to load services
      </option>
    `;

    serviceSelect.disabled =
      true;
  }
}


/* =======================================================
   Availability
   ======================================================= */

async function loadAvailability() {

  const serviceId =
    serviceSelect.value;

  const date =
    bookingDate.value;


  timeSelect.disabled = true;


  if (
    !serviceId ||
    !date
  ) {

    timeSelect.innerHTML = `
      <option value="">
        Choose a service and date first
      </option>
    `;

    availabilityStatus.textContent =
      "Available times will appear after you choose a service and date.";

    return;
  }


  timeSelect.innerHTML = `
    <option value="">
      Loading available times…
    </option>
  `;


  availabilityStatus.textContent =
    "Checking availability…";


  try {

    const query =
      new URLSearchParams({
        service_id:
          serviceId,
        date
      });


    const response =
      await fetch(
        `/api/bookings/availability?${query.toString()}`,
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
        "Unable to load availability."
      );
    }


    const slots =
      data.slots || [];


    if (
      slots.length === 0
    ) {

      timeSelect.innerHTML = `
        <option value="">
          No available times
        </option>
      `;

      timeSelect.disabled =
        true;

      availabilityStatus.textContent =
        "There are no available appointment times for this date.";

      return;
    }


    timeSelect.innerHTML = `
      <option value="">
        Choose a time
      </option>

      ${
        slots
          .map(
            (slot) => `
              <option
                value="${slot}"
              >
                ${formatTime(slot)}
              </option>
            `
          )
          .join("")
      }
    `;


    timeSelect.disabled =
      false;


    availabilityStatus.textContent =
      `${slots.length} available time${
        slots.length === 1
          ? ""
          : "s"
      } · ${data.timezone || ""}`;


  } catch (error) {

    timeSelect.innerHTML = `
      <option value="">
        Unable to load times
      </option>
    `;

    timeSelect.disabled =
      true;

    availabilityStatus.textContent =
      error.message ||
      "Unable to load availability.";
  }
}


/* =======================================================
   Create booking
   ======================================================= */

form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    if (
      !serviceSelect.value ||
      !bookingDate.value ||
      !timeSelect.value
    ) {

      showBookingError(
        "Choose a service, date and available time."
      );

      return;
    }


    const email =
      document
        .getElementById(
          "email"
        )
        .value
        .trim();

    const phone =
      document
        .getElementById(
          "phone"
        )
        .value
        .trim();


    if (
      !email &&
      !phone
    ) {

      showBookingError(
        "Enter an email address or phone number."
      );

      return;
    }


    bookingStatus.hidden =
      false;

    bookingStatus.className =
      "es-status";

    bookingStatus.textContent =
      "Creating booking…";

    saveBookingButton.disabled =
      true;


    const payload = {

      service_id:
        serviceSelect.value,

      date:
        bookingDate.value,

      time:
        timeSelect.value,

      first_name:
        document
          .getElementById(
            "firstName"
          )
          .value
          .trim(),

      last_name:
        document
          .getElementById(
            "lastName"
          )
          .value
          .trim(),

      email,

      phone,

      notes:
        document
          .getElementById(
            "notes"
          )
          .value
          .trim()
    };


    try {

      const response =
        await fetch(
          "/api/bookings",
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
              JSON.stringify(
                payload
              )
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
          "Unable to create booking."
        );
      }


      bookingStatus.className =
        "es-status success";

      bookingStatus.textContent =
        "Booking created.";


      await loadBookings();


      form.reset();

      setMinimumDate();

      timeSelect.disabled =
        true;

      timeSelect.innerHTML = `
        <option value="">
          Choose a service and date first
        </option>
      `;


      availabilityStatus.textContent =
        "Available times will appear after you choose a service and date.";


      setTimeout(
        closeBookingForm,
        600
      );


    } catch (error) {

      showBookingError(
        error.message ||
        "Unable to create booking."
      );


    } finally {

      saveBookingButton.disabled =
        false;
    }
  }
);


function showBookingError(
  message
) {

  bookingStatus.hidden =
    false;

  bookingStatus.className =
    "es-status error";

  bookingStatus.textContent =
    message;
}


/* =======================================================
   Booking list
   ======================================================= */

async function loadBookings() {

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
        "Unable to load bookings."
      );
    }


    bookings =
      data.bookings || [];


    renderBookings();


  } catch (error) {

    bookingsList.className =
      "es-status error";

    bookingsList.textContent =
      error.message ||
      "Unable to load bookings.";
  }
}


function renderBookings() {

  const query =
    bookingSearch.value
      .trim()
      .toLowerCase();

  const statusFilter =
    bookingStatusFilter.value;


  const filtered =
    bookings
      .filter(
        (booking) => {

          if (
            statusFilter !== "all" &&
            booking.status !==
              statusFilter
          ) {

            return false;
          }


          if (!query) {
            return true;
          }


          const searchText = [
            booking.first_name,
            booking.last_name,
            booking.email,
            booking.phone,
            booking.service_name
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return searchText.includes(
            query
          );
        }
      );


  if (
    filtered.length === 0
  ) {

    bookingsList.className =
      "es-empty-state";

    bookingsList.innerHTML = `
      <strong>
        ${
          bookings.length === 0
            ? "No bookings yet."
            : "No bookings match your filters."
        }
      </strong>

      <span>
        ${
          bookings.length === 0
            ? "Create your first appointment to get started."
            : "Try changing your search or status filter."
        }
      </span>
    `;

    return;
  }


  bookingsList.className =
    "es-bookings-list";


  bookingsList.innerHTML =
    filtered
      .map(
        (booking) => `
          <article class="es-booking-row">

            <div class="es-booking-date">

              <strong>
                ${formatDate(
                  booking.start_at
                )}
              </strong>

              <span>
                ${formatDateTimeRange(
                  booking.start_at,
                  booking.end_at
                )}
              </span>

            </div>


            <div class="es-booking-customer">

              <strong>
                ${escapeHtml(
                  booking.first_name
                )}
                ${escapeHtml(
                  booking.last_name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  booking.service_name
                )}
              </span>

              <small>
                ${
                  escapeHtml(
                    booking.email ||
                    booking.phone ||
                    ""
                  )
                }
              </small>

            </div>


            <div class="es-booking-money">

              <strong>
                ${formatMoney(
                  booking.price_minor
                )}
              </strong>

              ${
                Number(
                  booking.deposit_due_minor ||
                  0
                ) > 0
                  ? `
                    <small>
                      Deposit:
                      ${formatMoney(
                        booking.deposit_due_minor
                      )}
                    </small>
                  `
                  : ""
              }

            </div>


            <div>

              <span
                class="es-booking-status es-booking-status-${escapeHtml(
                  booking.status
                )}"
              >
                ${formatStatus(
                  booking.status
                )}
              </span>

            </div>

          </article>
        `
      )
      .join("");
}


/* =======================================================
   Form display
   ======================================================= */

function openBookingForm() {

  bookingStatus.hidden =
    true;

  formPanel.hidden =
    false;

  formPanel.scrollIntoView({
    behavior:
      "smooth",
    block:
      "start"
  });
}


function closeBookingForm() {

  formPanel.hidden =
    true;
}


/* =======================================================
   Formatters
   ======================================================= */

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
      amountMinor || 0
    ) / 100
  );
}


function formatDate(value) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday:
        "short",
      day:
        "numeric",
      month:
        "short"
    }
  ).format(
    new Date(value)
  );
}


function formatDateTimeRange(
  startValue,
  endValue
) {

  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        hour:
          "2-digit",
        minute:
          "2-digit"
      }
    );


  return `${
    formatter.format(
      new Date(startValue)
    )
  } – ${
    formatter.format(
      new Date(endValue)
    )
  }`;
}


function formatTime(value) {

  const [
    hour,
    minute
  ] =
    value
      .split(":")
      .map(Number);


  const date =
    new Date();

  date.setHours(
    hour,
    minute,
    0,
    0
  );


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  ).format(date);
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
    value;
}


function escapeHtml(value) {

  return String(
    value ?? ""
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

setMinimumDate();

Promise.all([
  loadServices(),
  loadBookings()
]);

