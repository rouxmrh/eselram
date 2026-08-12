const formPanel =
  document.getElementById(
    "bookingFormPanel"
  );

const form =
  document.getElementById(
    "bookingForm"
  );

const bookingId =
  document.getElementById(
    "bookingId"
  );

const selectedCustomerId =
  document.getElementById(
    "selectedCustomerId"
  );


const customerPackageId =
  document.getElementById(
    "customerPackageId"
  );

const packageBookingNotice =
  document.getElementById(
    "packageBookingNotice"
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

const customerSearch =
  document.getElementById(
    "customerSearch"
  );

const customerSearchResults =
  document.getElementById(
    "customerSearchResults"
  );

const selectedCustomer =
  document.getElementById(
    "selectedCustomer"
  );

const selectedCustomerText =
  document.getElementById(
    "selectedCustomerText"
  );

const bookingDetailsDialog =
  document.getElementById(
    "bookingDetailsDialog"
  );

const bookingDetailContent =
  document.getElementById(
    "bookingDetailContent"
  );

const bookingDetailActions =
  document.getElementById(
    "bookingDetailActions"
  );


let services = [];
let bookings = [];
let currentDetailBookingId = null;

let currentFormRequestBooking = null;
let currentGeneratedFormRequest = null;

const sendFormDialog =
  document.getElementById("sendFormDialog");

const sendFormTitle =
  document.getElementById("sendFormTitle");

const sendFormContext =
  document.getElementById("sendFormContext");

const sendFormTemplate =
  document.getElementById("sendFormTemplate");

const sendFormStatus =
  document.getElementById("sendFormStatus");

const generatedFormLinkWrap =
  document.getElementById("generatedFormLinkWrap");

const generatedFormLink =
  document.getElementById("generatedFormLink");

const bookingFormRequests =
  document.getElementById("bookingFormRequests");

let customerSearchTimer = null;


/* =======================================================
   Initial setup
   ======================================================= */

document
  .getElementById(
    "newBookingButton"
  )
  .addEventListener(
    "click",
    () =>
      openBookingForm()
  );


document
  .getElementById(
    "cancelBookingButton"
  )
  .addEventListener(
    "click",
    closeBookingForm
  );


document
  .getElementById(
    "clearSelectedCustomer"
  )
  .addEventListener(
    "click",
    clearCustomerSelection
  );


document
  .getElementById(
    "closeBookingDialog"
  )
  .addEventListener(
    "click",
    () =>
      bookingDetailsDialog.close()
  );


serviceSelect.addEventListener(
  "change",
  () => loadAvailability()
);


bookingDate.addEventListener(
  "change",
  () => loadAvailability()
);


bookingSearch.addEventListener(
  "input",
  renderBookings
);


bookingStatusFilter.addEventListener(
  "change",
  renderBookings
);


customerSearch.addEventListener(
  "input",
  () => {

    clearTimeout(
      customerSearchTimer
    );


    const query =
      customerSearch
        .value
        .trim();


    if (
      query.length < 2
    ) {

      customerSearchResults.hidden =
        true;

      customerSearchResults.innerHTML =
        "";

      return;
    }


    customerSearchTimer =
      setTimeout(
        () =>
          searchCustomers(
            query
          ),
        250
      );
  }
);


document.addEventListener(
  "click",
  (event) => {

    if (
      !event.target.closest(
        ".es-customer-search-wrap"
      )
    ) {

      customerSearchResults.hidden =
        true;
    }
  }
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

function refreshServiceOptionLabels(packageServiceId = "") {

  for (const service of services) {
    const option = Array.from(serviceSelect.options).find(
      (item) => item.value === service.id
    );

    if (!option) continue;

    const packageCovered =
      packageServiceId &&
      service.id === packageServiceId;

    option.textContent = packageCovered
      ? `${service.name} · ${service.duration_minutes} min · Covered by package`
      : `${service.name} · ${service.duration_minutes} min · ${formatMoney(service.price_minor)}`;
  }
}


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


    handleAuthentication(
      response
    );


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
      data.services ||
      [];


    if (
      services.length === 0
    ) {

      serviceSelect.innerHTML = `
        <option value="">
          No services available
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

    refreshServiceOptionLabels();


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
   Customers
   ======================================================= */

async function searchCustomers(
  query
) {

  try {

    const params =
      new URLSearchParams({
        customer_search:
          query
      });


    const response =
      await fetch(
        `/api/bookings?${params.toString()}`,
        {
          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );


    handleAuthentication(
      response
    );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to search customers."
      );
    }


    const customers =
      data.customers ||
      [];


    if (
      customers.length === 0
    ) {

      customerSearchResults.innerHTML = `
        <div class="es-customer-result">
          <strong>
            No customers found
          </strong>

          <span>
            Continue below to create a new customer.
          </span>
        </div>
      `;

      customerSearchResults.hidden =
        false;

      return;
    }


    customerSearchResults.innerHTML =
      customers
        .map(
          (customer) => `
            <button
              class="es-customer-result"
              type="button"
              data-customer-id="${escapeHtml(
                customer.id
              )}"
            >
              <strong>
                ${escapeHtml(
                  customer.first_name
                )}
                ${escapeHtml(
                  customer.last_name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  [
                    customer.email,
                    customer.phone
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}
              </span>
            </button>
          `
        )
        .join("");


    customerSearchResults
      .querySelectorAll(
        "[data-customer-id]"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              const customer =
                customers.find(
                  (item) =>
                    item.id ===
                    button.dataset
                      .customerId
                );


              if (customer) {

                selectCustomer(
                  customer
                );
              }
            }
          );
        }
      );


    customerSearchResults.hidden =
      false;


  } catch (error) {

    customerSearchResults.innerHTML = `
      <div class="es-customer-result">
        <strong>
          Unable to search customers
        </strong>
      </div>
    `;

    customerSearchResults.hidden =
      false;
  }
}


function selectCustomer(
  customer
) {

  selectedCustomerId.value =
    customer.id;


  document
    .getElementById(
      "firstName"
    )
    .value =
      customer.first_name ||
      "";


  document
    .getElementById(
      "lastName"
    )
    .value =
      customer.last_name ||
      "";


  document
    .getElementById(
      "email"
    )
    .value =
      customer.email ||
      "";


  document
    .getElementById(
      "phone"
    )
    .value =
      customer.phone ||
      "";


  selectedCustomerText.textContent =
    `${customer.first_name} ${customer.last_name}`;


  selectedCustomer.hidden =
    false;


  customerSearch.value =
    "";


  customerSearchResults.hidden =
    true;
}


function clearCustomerSelection() {

  selectedCustomerId.value =
    "";

  customerPackageId.value =
    "";

  packageBookingNotice.hidden =
    true;

  packageBookingNotice.textContent =
    "";

  selectedCustomer.hidden =
    true;

  selectedCustomerText.textContent =
    "";
}


/* =======================================================
   Availability
   ======================================================= */

async function loadAvailability(
  preferredTime = ""
) {

  const serviceId =
    serviceSelect.value;

  const date =
    bookingDate.value;


  timeSelect.disabled =
    true;


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


    const currentBookingId =
      bookingId.value;


    if (currentBookingId) {

      query.set(
        "exclude_appointment_id",
        currentBookingId
      );
    }


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


    handleAuthentication(
      response
    );


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
      data.slots ||
      [];


    if (
      preferredTime &&
      !slots.includes(
        preferredTime
      )
    ) {

      slots.unshift(
        preferredTime
      );
    }


    if (
      slots.length === 0
    ) {

      timeSelect.innerHTML = `
        <option value="">
          No available times
        </option>
      `;

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
                value="${escapeHtml(
                  slot
                )}"
              >
                ${formatTime(
                  slot
                )}
              </option>
            `
          )
          .join("")
      }
    `;


    timeSelect.disabled =
      false;


    if (
      preferredTime &&
      slots.includes(
        preferredTime
      )
    ) {

      timeSelect.value =
        preferredTime;
    }


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
   Create / edit booking
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


    const firstName =
      document
        .getElementById(
          "firstName"
        )
        .value
        .trim();

    const lastName =
      document
        .getElementById(
          "lastName"
        )
        .value
        .trim();

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
      !firstName ||
      !lastName
    ) {

      showBookingError(
        "Enter the customer's first and last name."
      );

      return;
    }


    if (
      !email &&
      !phone
    ) {

      showBookingError(
        "Enter an email address or phone number."
      );

      return;
    }


    const editing =
      Boolean(
        bookingId.value
      );


    bookingStatus.hidden =
      false;

    bookingStatus.className =
      "es-status";

    bookingStatus.textContent =
      editing
        ? "Saving changes…"
        : "Creating booking…";


    saveBookingButton.disabled =
      true;


    const payload = {

      id:
        bookingId.value ||
        undefined,

      customer_id:
        selectedCustomerId.value ||
        undefined,

      customer_package_id:
        customerPackageId.value ||
        undefined,

      service_id:
        serviceSelect.value,

      date:
        bookingDate.value,

      time:
        timeSelect.value,

      first_name:
        firstName,

      last_name:
        lastName,

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


    if (editing) {

      payload.action =
        "update";
    }


    try {

      const response =
        await fetch(
          "/api/bookings",
          {
            method:
              editing
                ? "PUT"
                : "POST",

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


      handleAuthentication(
        response
      );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          (
            editing
              ? "Unable to update booking."
              : "Unable to create booking."
          )
        );
      }


      bookingStatus.className =
        "es-status success";

      bookingStatus.textContent =
        editing
          ? "Booking updated."
          : "Booking created.";


      await loadBookings();


      if (editing) {

        const updated =
          bookings.find(
            (booking) =>
              booking.id ===
              bookingId.value
          );


        if (updated) {

          showBookingDetails(
            updated
          );
        }
      }


      resetBookingForm();


    } catch (error) {

      showBookingError(
        error.message ||
        "Unable to save booking."
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


    handleAuthentication(
      response
    );


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
      data.bookings ||
      [];


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
    bookings.filter(
      (booking) => {

        if (
          statusFilter !==
            "all" &&
          booking.status !==
            statusFilter
        ) {

          return false;
        }


        if (!query) {
          return true;
        }


        const searchable = [
          booking.first_name,
          booking.last_name,
          booking.email,
          booking.phone,
          booking.service_name,
          booking.package_name,
          booking.status,
          formatStatus(
            booking.status
          ),
          formatDate(
            booking.start_at
          )
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        return searchable.includes(
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
                ${escapeHtml(
                  booking.email ||
                  booking.phone ||
                  ""
                )}
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


            <div class="es-booking-actions">

              <button
                class="es-booking-action"
                type="button"
                data-view="${escapeHtml(
                  booking.id
                )}"
              >
                View
              </button>

              ${
                booking.status ===
                  "confirmed"
                  ? `
                    <button
                      class="es-booking-action"
                      type="button"
                      data-edit="${escapeHtml(
                        booking.id
                      )}"
                    >
                      Edit
                    </button>

                    <button
                      class="es-booking-action"
                      type="button"
                      data-complete="${escapeHtml(
                        booking.id
                      )}"
                    >
                      Complete
                    </button>

                    <button
                      class="es-booking-action danger"
                      type="button"
                      data-cancel="${escapeHtml(
                        booking.id
                      )}"
                    >
                      Cancel
                    </button>
                  `
                  : ""
              }

            </div>

          </article>
        `
      )
      .join("");


  bindBookingRowActions();
}


function bindBookingRowActions() {

  document
    .querySelectorAll(
      "[data-view]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const booking =
              getBooking(
                button.dataset.view
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
      "[data-edit]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const booking =
              getBooking(
                button.dataset.edit
              );


            if (booking) {

              openBookingForm(
                booking
              );
            }
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-complete]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () =>
            completeBooking(
              button.dataset
                .complete
            )
        );
      }
    );


  document
    .querySelectorAll(
      "[data-cancel]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () =>
            cancelBooking(
              button.dataset
                .cancel
            )
        );
      }
    );
}



/* =======================================================
   Secure client form links
   ======================================================= */

document
  .getElementById("closeSendFormDialog")
  ?.addEventListener("click", () => {
    sendFormDialog.close();
  });

document
  .getElementById("generateFormLinkButton")
  ?.addEventListener("click", generateBookingFormLink);

document
  .getElementById("copyGeneratedFormLink")
  ?.addEventListener("click", async () => {
    if (!generatedFormLink.value) return;

    try {
      await navigator.clipboard.writeText(
        generatedFormLink.value
      );

      showBookingFormRequestStatus(
        "Secure form link copied.",
        "success"
      );
    } catch {
      generatedFormLink.select();
      document.execCommand("copy");
    }
  });


document
  .getElementById("emailGeneratedFormLink")
  ?.addEventListener(
    "click",
    async () => {
      if (!currentGeneratedFormRequest?.id) {
        showBookingFormRequestStatus(
          "Generate the secure consultation link first.",
          "error"
        );
        return;
      }

      await sendBookingConsultationEmail(
        currentGeneratedFormRequest.id
      );
    }
  );


async function sendBookingConsultationEmail(
  formRequestId
) {
  const button =
    document.getElementById(
      "emailGeneratedFormLink"
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      "Sending…";
  }

  try {
    const response =
      await fetch(
        "/api/form-requests/email",
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
              form_request_id:
                formRequestId
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
        "Unable to send consultation email."
      );
    }

    showBookingFormRequestStatus(
      data.duplicate || data.skipped
        ? "This form email has already been sent."
        : "Consultation email sent successfully.",
      "success"
    );

    if (currentFormRequestBooking) {
      await loadBookingFormRequests(
        currentFormRequestBooking.id
      );
    }
  } catch (error) {
    showBookingFormRequestStatus(
      error.message ||
      "Unable to send consultation email.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "Send by email";
    }
  }
}


async function openBookingFormRequest(
  booking
) {
  currentFormRequestBooking =
    booking;

  currentGeneratedFormRequest =
    null;

  sendFormTitle.textContent =
    "Send client form";

  sendFormContext.textContent =
    `${booking.first_name} ${booking.last_name} · ${booking.service_name} · ${formatFullDate(booking.start_at)}`;

  sendFormTemplate.innerHTML =
    `<option value="">Loading forms…</option>`;

  bookingFormRequests.innerHTML =
    `<div class="es-empty-state">Loading form history…</div>`;

  generatedFormLinkWrap.hidden =
    true;

  sendFormStatus.hidden =
    true;

  if (
    typeof sendFormDialog.showModal ===
    "function"
  ) {
    sendFormDialog.showModal();
  }

  await loadBookingFormRequests(
    booking.id
  );
}


async function loadBookingFormRequests(
  appointmentId
) {
  try {
    const response =
      await fetch(
        `/api/form-requests?appointment_id=${encodeURIComponent(appointmentId)}`,
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
        "Unable to load forms."
      );
    }

    sendFormTemplate.innerHTML =
      `<option value="">Choose a form</option>` +
      (data.templates || [])
        .map(
          template => `
            <option value="${escapeHtml(template.id)}">
              ${escapeHtml(template.name)}
            </option>
          `
        )
        .join("");

    if (!(data.templates || []).length) {
      showBookingFormRequestStatus(
        "Publish at least one Clinical Template before sending a form.",
        "error"
      );
    }

    renderBookingFormRequests(
      data.requests || []
    );
  } catch (error) {
    showBookingFormRequestStatus(
      error.message ||
      "Unable to load forms.",
      "error"
    );
  }
}


function renderBookingFormRequests(
  requests
) {
  if (!requests.length) {
    bookingFormRequests.innerHTML = `
      <div class="es-empty-state">
        <strong>No forms sent for this appointment yet.</strong>
      </div>
    `;

    return;
  }

  bookingFormRequests.innerHTML =
    requests
      .map(
        request => `
          <div class="es-form-request-item">
            <div class="es-form-request-item-main">
              <strong>
                ${escapeHtml(request.template_name)}
              </strong>

              <span>
                Created ${formatFullDateTime(request.created_at)}
              </span>

              <small>
                ${
                  request.email_status === "sent"
                    ? `Email sent to ${escapeHtml(request.email_to || "")}${request.email_send_count > 1 ? ` · ${request.email_send_count} sends` : ""}`
                    : request.email_status === "failed"
                      ? "Last email attempt failed"
                      : "Email not sent"
                }
              </small>
            </div>

            <div class="es-customer-appointment-actions">
              ${
                ["created", "opened"].includes(request.status)
                  ? `
                    <button
                      type="button"
                      class="es-secondary-button"
                      data-resend-consultation="${escapeHtml(request.id)}"
                    >
                      ${request.email_status === "sent" ? "Resend email" : "Send email"}
                    </button>
                  `
                  : ""
              }

              <span class="es-form-request-status ${escapeHtml(request.display_status)}">
                ${escapeHtml(formatFormRequestStatus(request.display_status))}
              </span>
            </div>
          </div>
        `
      )
      .join("");

  bookingFormRequests
    .querySelectorAll(
      "[data-resend-consultation]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            sendBookingConsultationEmail(
              button.dataset.resendConsultation
            )
        );
      }
    );
}


async function generateBookingFormLink() {
  if (!currentFormRequestBooking) {
    return;
  }

  const templateId =
    sendFormTemplate.value;

  if (!templateId) {
    showBookingFormRequestStatus(
      "Choose a form first.",
      "error"
    );

    return;
  }

  const button =
    document.getElementById(
      "generateFormLinkButton"
    );

  button.disabled =
    true;

  button.textContent =
    "Generating…";

  try {
    const response =
      await fetch(
        "/api/form-requests",
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
              template_id:
                templateId,
              appointment_id:
                currentFormRequestBooking.id
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
        "Unable to generate form link."
      );
    }

    currentGeneratedFormRequest =
      data.request;

    generatedFormLink.value =
      `${location.origin}${data.request.url_path}`;

    generatedFormLinkWrap.hidden =
      false;

    showBookingFormRequestStatus(
      data.reused
        ? "Existing secure link ready to copy."
        : "Secure form link created.",
      "success"
    );

    await loadBookingFormRequests(
      currentFormRequestBooking.id
    );
  } catch (error) {
    showBookingFormRequestStatus(
      error.message ||
      "Unable to generate form link.",
      "error"
    );
  } finally {
    button.disabled =
      false;

    button.textContent =
      "Generate secure link";
  }
}


function showBookingFormRequestStatus(
  message,
  type = ""
) {
  sendFormStatus.hidden =
    false;

  sendFormStatus.className =
    `es-status ${type}`.trim();

  sendFormStatus.textContent =
    message;
}


function formatFormRequestStatus(
  status
) {
  return {
    created:
      "Link created",
    opened:
      "Opened",
    submitted:
      "Completed",
    reviewed:
      "Reviewed",
    revoked:
      "Revoked"
  }[status] ||
  formatStatus(status);
}

function getBooking(id) {

  return bookings.find(
    (booking) =>
      booking.id === id
  );
}


/* =======================================================
   Booking details
   ======================================================= */



/* =======================================================
   Stripe Checkout payment links
   ======================================================= */

const paymentLinkDialog =
  document.getElementById(
    "paymentLinkDialog"
  );

const paymentLinkStatus =
  document.getElementById(
    "paymentLinkStatus"
  );

const paymentLinkResult =
  document.getElementById(
    "paymentLinkResult"
  );

const generatedPaymentLink =
  document.getElementById(
    "generatedPaymentLink"
  );

const openPaymentLink =
  document.getElementById(
    "openPaymentLink"
  );

const paymentLinkContext =
  document.getElementById(
    "paymentLinkContext"
  );


document
  .getElementById(
    "closePaymentLinkDialog"
  )
  ?.addEventListener(
    "click",
    () =>
      paymentLinkDialog.close()
  );


document
  .getElementById(
    "copyPaymentLink"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !generatedPaymentLink.value
      ) {
        return;
      }


      try {

        await navigator.clipboard.writeText(
          generatedPaymentLink.value
        );

      } catch {

        generatedPaymentLink.select();

        document.execCommand(
          "copy"
        );
      }


      paymentLinkStatus.hidden =
        false;

      paymentLinkStatus.className =
        "es-status success";

      paymentLinkStatus.textContent =
        "Payment link copied.";
    }
  );


async function createStripePaymentLink(
  booking
) {

  paymentLinkResult.hidden =
    true;

  paymentLinkStatus.hidden =
    false;

  paymentLinkStatus.className =
    "es-status";

  paymentLinkStatus.textContent =
    "Creating secure Stripe Checkout…";


  paymentLinkContext.textContent =
    `${booking.first_name} ${booking.last_name} · ${booking.service_name}`;


  if (
    typeof paymentLinkDialog
      .showModal === "function"
  ) {

    paymentLinkDialog.showModal();
  }


  try {

    const response =
      await fetch(
        "/api/payments/stripe/checkout",
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
              appointment_id:
                booking.id
            })
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
        "Unable to create payment link."
      );
    }


    generatedPaymentLink.value =
      data.checkout.url;


    openPaymentLink.href =
      data.checkout.url;


    paymentLinkResult.hidden =
      false;

    paymentLinkStatus.className =
      "es-status success";

    paymentLinkStatus.textContent =
      `${formatMoney(
        data.checkout.amount_minor
      )} Checkout created for ${data.checkout.customer_email}.`;


  } catch (error) {

    paymentLinkStatus.className =
      "es-status error";

    paymentLinkStatus.textContent =
      error.message ||
      "Unable to create payment link.";
  }
}


function showBookingDetails(
  booking
) {

  currentDetailBookingId =
    booking.id;


  document
    .getElementById(
      "detailCustomerName"
    )
    .textContent =
      `${booking.first_name} ${booking.last_name}`;


  bookingDetailContent.innerHTML = `
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
        booking.start_at
      )
    )}

    ${detailItem(
      "Time",
      formatDateTimeRange(
        booking.start_at,
        booking.end_at
      )
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
      "Customer notes",
      booking.notes ||
      "No notes",
      true
    )}

    ${detailItem(
      "Booking source",
      booking.booking_source ||
      "—"
    )}

    ${detailItem(
      "Created",
      booking.created_at
        ? formatFullDateTime(
            booking.created_at
          )
        : "—"
    )}
  `;


  bookingDetailActions.innerHTML = `
    ${
      booking.status !== "cancelled"
        ? `
          <button
            id="detailPaymentLinkButton"
            class="es-button"
            type="button"
          >
            Create payment link
          </button>

          <button
            id="detailSendFormButton"
            class="es-button"
            type="button"
          >
            Send form
          </button>
        `
        : ""
    }

    ${
      booking.status === "confirmed"
        ? `
        <button
          id="detailEditButton"
          class="es-secondary-button"
          type="button"
        >
          Edit / reschedule
        </button>

        <button
          id="detailCompleteButton"
          class="es-secondary-button"
          type="button"
        >
          Mark completed
        </button>

        <button
          id="detailCancelButton"
          class="es-secondary-button"
          type="button"
        >
          Cancel booking
        </button>
        `
        : ""
    }
  `;

  const detailPaymentLinkButton =
    document.getElementById(
      "detailPaymentLinkButton"
    );


  if (detailPaymentLinkButton) {

    detailPaymentLinkButton.addEventListener(
      "click",
      () => {

        bookingDetailsDialog.close();

        createStripePaymentLink(
          booking
        );
      }
    );
  }


  const detailSendFormButton =
    document.getElementById(
      "detailSendFormButton"
    );

  if (detailSendFormButton) {
    detailSendFormButton.addEventListener(
      "click",
      () => {
        bookingDetailsDialog.close();
        openBookingFormRequest(booking);
      }
    );
  }


  if (
    booking.status ===
    "confirmed"
  ) {

    document
      .getElementById(
        "detailEditButton"
      )
      .addEventListener(
        "click",
        () => {

          bookingDetailsDialog.close();

          openBookingForm(
            booking
          );
        }
      );


    document
      .getElementById(
        "detailCompleteButton"
      )
      .addEventListener(
        "click",
        () =>
          completeBooking(
            booking.id
          )
      );


    document
      .getElementById(
        "detailCancelButton"
      )
      .addEventListener(
        "click",
        () =>
          cancelBooking(
            booking.id
          )
      );
  }


  if (
    typeof bookingDetailsDialog
      .showModal ===
    "function"
  ) {

    bookingDetailsDialog.showModal();
  }
}


function detailItem(
  label,
  value,
  full = false
) {

  return `
    <div
      class="es-booking-detail ${
        full
          ? "es-booking-detail-full"
          : ""
      }"
    >
      <span>
        ${escapeHtml(label)}
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
   Status actions
   ======================================================= */

async function completeBooking(
  id
) {

  const booking =
    getBooking(id);


  if (!booking) {
    return;
  }


  const confirmed =
    window.confirm(
      `Mark ${booking.first_name} ${booking.last_name}'s booking as completed?`
    );


  if (!confirmed) {
    return;
  }


  await updateBookingAction({
    id,
    action:
      "complete",
    successMessage:
      "Booking marked as completed."
  });
}


async function cancelBooking(
  id
) {

  const booking =
    getBooking(id);


  if (!booking) {
    return;
  }


  const confirmed =
    window.confirm(
      `Cancel ${booking.first_name} ${booking.last_name}'s booking?`
    );


  if (!confirmed) {
    return;
  }


  const reason =
    window.prompt(
      "Cancellation reason (optional):",
      ""
    );


  if (reason === null) {
    return;
  }


  await updateBookingAction({
    id,
    action:
      "cancel",
    reason,
    successMessage:
      "Booking cancelled."
  });
}


async function updateBookingAction({
  id,
  action,
  reason = "",
  successMessage
}) {

  try {

    const response =
      await fetch(
        "/api/bookings",
        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              id,
              action,
              reason
            })
        }
      );


    handleAuthentication(
      response
    );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to update booking."
      );
    }


    await loadBookings();


    if (
      bookingDetailsDialog.open
    ) {

      bookingDetailsDialog.close();
    }


    const status =
      document.createElement(
        "div"
      );

    status.className =
      "es-status success";

    status.textContent =
      successMessage;

    bookingsList.parentElement
      .prepend(status);


    setTimeout(
      () =>
        status.remove(),
      3000
    );


  } catch (error) {

    window.alert(
      error.message ||
      "Unable to update booking."
    );
  }
}


/* =======================================================
   Form display
   ======================================================= */

function openBookingForm(
  booking = null
) {

  resetBookingForm(
    false
  );


  bookingStatus.hidden =
    true;


  if (booking) {

    bookingId.value =
      booking.id;

    selectedCustomerId.value =
      booking.customer_id ||
      "";


    if (
      booking.customer_package_id
    ) {
      customerPackageId.value =
        booking.customer_package_id;

      packageBookingNotice.hidden =
        false;

      packageBookingNotice.textContent =
        `${booking.package_name || "Package"} · this appointment is covered by the package.`;

      refreshServiceOptionLabels(
        booking.service_id
      );
    }


    document
      .getElementById(
        "bookingFormEyebrow"
      )
      .textContent =
        "Edit booking";


    document
      .getElementById(
        "bookingFormTitle"
      )
      .textContent =
        "Edit or reschedule appointment";


    saveBookingButton.textContent =
      "Save changes";


    serviceSelect.value =
      booking.service_id;

    serviceSelect.disabled =
      Boolean(
        booking.customer_package_id
      );


    const parts =
      splitDateTime(
        booking.start_at
      );


    bookingDate.value =
      parts.date;


    document
      .getElementById(
        "firstName"
      )
      .value =
        booking.first_name ||
        "";


    document
      .getElementById(
        "lastName"
      )
      .value =
        booking.last_name ||
        "";


    document
      .getElementById(
        "email"
      )
      .value =
        booking.email ||
        "";


    document
      .getElementById(
        "phone"
      )
      .value =
        booking.phone ||
        "";


    document
      .getElementById(
        "notes"
      )
      .value =
        booking.notes ||
        "";


    selectedCustomerText.textContent =
      `${booking.first_name} ${booking.last_name}`;


    selectedCustomer.hidden =
      false;


    loadAvailability(
      parts.time
    );

  } else {

    document
      .getElementById(
        "bookingFormEyebrow"
      )
      .textContent =
        "New booking";


    document
      .getElementById(
        "bookingFormTitle"
      )
      .textContent =
        "Create appointment";


    saveBookingButton.textContent =
      "Create booking";
  }


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

  resetBookingForm();
}


function resetBookingForm(
  hidePanel = true
) {

  form.reset();

  bookingId.value =
    "";

  selectedCustomerId.value =
    "";

  customerPackageId.value =
    "";

  packageBookingNotice.hidden =
    true;

  packageBookingNotice.textContent =
    "";

  serviceSelect.disabled =
    false;

  refreshServiceOptionLabels();

  selectedCustomer.hidden =
    true;

  selectedCustomerText.textContent =
    "";

  customerSearchResults.hidden =
    true;

  customerSearchResults.innerHTML =
    "";

  bookingStatus.hidden =
    true;

  timeSelect.disabled =
    true;

  timeSelect.innerHTML = `
    <option value="">
      Choose a service and date first
    </option>
  `;

  availabilityStatus.textContent =
    "Available times will appear after you choose a service and date.";

  document
    .getElementById(
      "bookingFormEyebrow"
    )
    .textContent =
      "New booking";

  document
    .getElementById(
      "bookingFormTitle"
    )
    .textContent =
      "Create appointment";

  saveBookingButton.textContent =
    "Create booking";


  setMinimumDate();


  if (hidePanel) {

    formPanel.hidden =
      true;
  }
}


/* =======================================================
   Helpers / formatters
   ======================================================= */

function handleAuthentication(
  response
) {

  if (
    response.status ===
    401
  ) {

    window.location.href =
      "/auth/login.html";

    throw new Error(
      "Authentication required."
    );
  }
}


function splitDateTime(value) {

  const raw =
    String(value || "");


  if (
    raw.includes("T")
  ) {

    const [
      date,
      timePart
    ] =
      raw.split("T");


    return {
      date,
      time:
        timePart
          .slice(0, 5)
    };
  }


  return {
    date: "",
    time: ""
  };
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


function formatFullDate(value) {

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
  ).format(
    new Date(value)
  );
}


function formatFullDateTime(
  value
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium",
      timeStyle:
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

async function openPackageBooking(
  packageId
) {
  const response =
    await fetch(
      `/api/packages?customer_package_id=${encodeURIComponent(
        packageId
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

  handleAuthentication(
    response
  );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.error ||
      "Unable to load package."
    );
  }

  const item =
    data.customer_package;

  if (
    item.status !==
      "active" ||
    Number(
      item.sessions_available_to_book ||
      0
    ) <= 0
  ) {
    throw new Error(
      "This package has no sessions available to book."
    );
  }

  openBookingForm();

  customerPackageId.value =
    item.id;

  selectedCustomerId.value =
    item.customer_id;

  serviceSelect.value =
    item.service_id;

  refreshServiceOptionLabels(
    item.service_id
  );

  document.getElementById(
    "firstName"
  ).value =
    item.first_name ||
    "";

  document.getElementById(
    "lastName"
  ).value =
    item.last_name ||
    "";

  document.getElementById(
    "email"
  ).value =
    item.email ||
    "";

  document.getElementById(
    "phone"
  ).value =
    item.phone ||
    "";

  selectedCustomerText.textContent =
    `${item.first_name} ${item.last_name}`;

  selectedCustomer.hidden =
    false;

  packageBookingNotice.hidden =
    false;

  packageBookingNotice.textContent =
    `${item.name_snapshot} · ${item.sessions_available_to_book} session${
      Number(item.sessions_available_to_book) === 1
        ? ""
        : "s"
    } available · this appointment is covered by the package.`;

  document.getElementById(
    "bookingFormTitle"
  ).textContent =
    `Book package session · ${item.name_snapshot}`;
}


async function initialiseBookingsPage() {

  setMinimumDate();

  await Promise.all([
    loadServices(),
    loadBookings()
  ]);


  const params =
    new URLSearchParams(
      window.location.search
    );


  const date =
    params.get(
      "date"
    );


  const bookingIdFromUrl =
    params.get(
      "booking"
    );


  const packageIdFromUrl =
    params.get(
      "package"
    );


  if (packageIdFromUrl) {
    await openPackageBooking(
      packageIdFromUrl
    );
  }


  if (date && !packageIdFromUrl) {

    openBookingForm();

    bookingDate.value =
      date;


    if (
      serviceSelect.value
    ) {

      await loadAvailability();
    }
  }


  if (
    bookingIdFromUrl
  ) {

    const booking =
      bookings.find(
        (item) =>
          item.id ===
          bookingIdFromUrl
      );


    if (booking) {

      showBookingDetails(
        booking
      );
    }
  }
}


initialiseBookingsPage();
