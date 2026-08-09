const customersList =
  document.getElementById(
    "customersList"
  );

const customerSearch =
  document.getElementById(
    "customerSearch"
  );

const customerFormPanel =
  document.getElementById(
    "customerFormPanel"
  );

const customerForm =
  document.getElementById(
    "customerForm"
  );

const customerId =
  document.getElementById(
    "customerId"
  );

const customerFormStatus =
  document.getElementById(
    "customerFormStatus"
  );

const saveCustomerButton =
  document.getElementById(
    "saveCustomerButton"
  );

const customerDrawer =
  document.getElementById(
    "customerDrawer"
  );

const customerDrawerBackdrop =
  document.getElementById(
    "customerDrawerBackdrop"
  );

const customerDrawerName =
  document.getElementById(
    "customerDrawerName"
  );

const customerDrawerMeta =
  document.getElementById(
    "customerDrawerMeta"
  );

const customerProfileStats =
  document.getElementById(
    "customerProfileStats"
  );

const customerDetails =
  document.getElementById(
    "customerDetails"
  );

const customerUpcomingBookings =
  document.getElementById(
    "customerUpcomingBookings"
  );

const customerBookingHistory =
  document.getElementById(
    "customerBookingHistory"
  );

const newCustomerBookingButton =
  document.getElementById(
    "newCustomerBookingButton"
  );


let customers = [];

let activeProfileCustomer = null;
let currentCustomerGeneratedFormRequest = null;

const customerSendFormDialog =
  document.getElementById(
    "customerSendFormDialog"
  );

const customerFormAppointment =
  document.getElementById(
    "customerFormAppointment"
  );

const customerFormTemplate =
  document.getElementById(
    "customerFormTemplate"
  );

const customerSendFormStatus =
  document.getElementById(
    "customerSendFormStatus"
  );

const customerGeneratedFormLinkWrap =
  document.getElementById(
    "customerGeneratedFormLinkWrap"
  );

const customerGeneratedFormLink =
  document.getElementById(
    "customerGeneratedFormLink"
  );

const customerFormRequests =
  document.getElementById(
    "customerFormRequests"
  );

let activeCustomer = null;


document
  .getElementById(
    "newCustomerButton"
  )
  .addEventListener(
    "click",
    () =>
      openCustomerForm()
  );


document
  .getElementById(
    "closeCustomerFormButton"
  )
  .addEventListener(
    "click",
    closeCustomerForm
  );


document
  .getElementById(
    "closeCustomerDrawer"
  )
  .addEventListener(
    "click",
    closeCustomerDrawer
  );


customerDrawerBackdrop
  .addEventListener(
    "click",
    closeCustomerDrawer
  );


document
  .getElementById(
    "editCustomerButton"
  )
  .addEventListener(
    "click",
    () => {

      if (!activeCustomer) {
        return;
      }

      closeCustomerDrawer();

      openCustomerForm(
        activeCustomer
      );
    }
  );


customerSearch.addEventListener(
  "input",
  renderCustomers
);


document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape"
    ) {

      if (
        customerDrawer
          .classList
          .contains(
            "is-open"
          )
      ) {

        closeCustomerDrawer();
      }
    }
  }
);


/* =======================================================
   Load list
   ======================================================= */

async function loadCustomers() {

  try {

    const response =
      await fetch(
        "/api/customers",
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
        "Unable to load customers."
      );
    }


    customers =
      data.customers ||
      [];


    renderCustomers();


  } catch (error) {

    customersList.className =
      "es-status error";

    customersList.textContent =
      error.message ||
      "Unable to load customers.";
  }
}


function renderCustomers() {

  const query =
    customerSearch
      .value
      .trim()
      .toLowerCase();


  const filtered =
    customers.filter(
      (customer) => {

        if (!query) {
          return true;
        }


        const searchable = [
          customer.first_name,
          customer.last_name,
          customer.email,
          customer.phone
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

    customersList.className =
      "es-empty-state";

    customersList.innerHTML = `
      <strong>
        ${
          customers.length === 0
            ? "No customers yet."
            : "No customers match your search."
        }
      </strong>

      <span>
        ${
          customers.length === 0
            ? "Customers created through bookings will appear here automatically."
            : "Try another name, email address or phone number."
        }
      </span>
    `;

    return;
  }


  customersList.className =
    "es-customers-list";


  customersList.innerHTML =
    filtered
      .map(
        (customer) => `
          <article class="es-customer-row">

            <div class="es-customer-main">

              <strong>
                ${escapeHtml(
                  `${customer.first_name} ${customer.last_name}`
                )}
              </strong>

              <span>
                Customer since
                ${formatDate(
                  customer.created_at
                )}
              </span>

            </div>


            <div class="es-customer-contact">

              <span>
                ${escapeHtml(
                  customer.email ||
                  "No email"
                )}
              </span>

              <span>
                ${escapeHtml(
                  customer.phone ||
                  "No phone"
                )}
              </span>

            </div>


            <div class="es-customer-stat">

              <strong>
                ${customer.visit_count || 0}
              </strong>

              <span>
                visits
              </span>

            </div>


            <div class="es-customer-stat">

              <strong>
                ${formatMoney(
                  customer.total_paid_minor
                )}
              </strong>

              <span>
                paid
              </span>

            </div>


            <div class="es-customer-actions">

              <button
                class="es-customer-action"
                type="button"
                data-view-customer="${escapeHtml(
                  customer.id
                )}"
              >
                View
              </button>

            </div>

          </article>
        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-view-customer]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () =>
            loadCustomerProfile(
              button.dataset
                .viewCustomer
            )
        );
      }
    );
}


/* =======================================================
   Profile
   ======================================================= */

async function loadCustomerProfile(
  id
) {

  try {

    const response =
      await fetch(
        `/api/customers?id=${encodeURIComponent(
          id
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
        "Unable to load customer."
      );
    }


    activeCustomer =
      data.customer;


    renderCustomerProfile(
      data.customer
    );


    openCustomerDrawer();


  } catch (error) {

    window.alert(
      error.message ||
      "Unable to load customer."
    );
  }
}



document
  .getElementById(
    "sendCustomerFormButton"
  )
  ?.addEventListener(
    "click",
    openCustomerFormRequest
  );

document
  .getElementById(
    "closeCustomerSendFormDialog"
  )
  ?.addEventListener(
    "click",
    () => {
      customerSendFormDialog.close();
    }
  );

document
  .getElementById(
    "generateCustomerFormLinkButton"
  )
  ?.addEventListener(
    "click",
    generateCustomerFormLink
  );

document
  .getElementById(
    "copyCustomerGeneratedFormLink"
  )
  ?.addEventListener(
    "click",
    async () => {
      if (
        !customerGeneratedFormLink.value
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          customerGeneratedFormLink.value
        );

        showCustomerFormStatus(
          "Secure form link copied.",
          "success"
        );
      } catch {
        customerGeneratedFormLink.select();
        document.execCommand("copy");
      }
    }
  );


document
  .getElementById(
    "emailCustomerGeneratedFormLink"
  )
  ?.addEventListener(
    "click",
    async () => {
      if (
        !currentCustomerGeneratedFormRequest?.id
      ) {
        showCustomerFormStatus(
          "Generate the secure consultation link first.",
          "error"
        );
        return;
      }

      await sendCustomerConsultationEmail(
        currentCustomerGeneratedFormRequest.id
      );
    }
  );


async function sendCustomerConsultationEmail(
  formRequestId
) {
  const button =
    document.getElementById(
      "emailCustomerGeneratedFormLink"
    );

  if (button) {
    button.disabled =
      true;

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

    showCustomerFormStatus(
      `Consultation emailed to ${data.email.to}.`,
      "success"
    );

    await loadCustomerFormRequests();
  } catch (error) {
    showCustomerFormStatus(
      error.message ||
      "Unable to send consultation email.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        "Send by email";
    }
  }
}


async function openCustomerFormRequest() {
  if (!activeProfileCustomer) {
    return;
  }

  currentCustomerGeneratedFormRequest =
    null;

  document
    .getElementById(
      "customerSendFormTitle"
    )
    .textContent =
      `Send form to ${activeProfileCustomer.first_name}`;

  customerGeneratedFormLinkWrap.hidden =
    true;

  customerSendFormStatus.hidden =
    true;

  const appointments = [
    ...(activeProfileCustomer.upcoming_bookings || []),
    ...(activeProfileCustomer.booking_history || [])
  ];

  customerFormAppointment.innerHTML =
    `<option value="">Customer only — no appointment</option>` +
    appointments
      .filter(
        appointment =>
          appointment.status !==
          "cancelled"
      )
      .map(
        appointment => `
          <option value="${escapeHtml(appointment.id)}">
            ${escapeHtml(
              `${formatShortDate(appointment.start_at)} · ${appointment.service_name}`
            )}
          </option>
        `
      )
      .join("");

  if (
    typeof customerSendFormDialog
      .showModal ===
    "function"
  ) {
    customerSendFormDialog.showModal();
  }

  await loadCustomerFormRequests();
}


async function loadCustomerFormRequests() {
  if (!activeProfileCustomer) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/form-requests?customer_id=${encodeURIComponent(activeProfileCustomer.id)}`,
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

    customerFormTemplate.innerHTML =
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
      showCustomerFormStatus(
        "Publish at least one Clinical Template before sending a form.",
        "error"
      );
    }

    renderCustomerFormRequests(
      data.requests || []
    );
  } catch (error) {
    showCustomerFormStatus(
      error.message ||
      "Unable to load forms.",
      "error"
    );
  }
}


function renderCustomerFormRequests(
  requests
) {
  if (!requests.length) {
    customerFormRequests.innerHTML = `
      <div class="es-empty-state">
        <strong>No client forms yet.</strong>
      </div>
    `;

    return;
  }

  customerFormRequests.innerHTML =
    requests
      .map(
        request => `
          <div class="es-form-request-item">
            <div class="es-form-request-item-main">
              <strong>
                ${escapeHtml(request.template_name)}
              </strong>

              <span>
                ${
                  request.service_name
                    ? escapeHtml(
                        `${request.service_name} · ${formatShortDate(request.appointment_start_at)}`
                      )
                    : "Customer form"
                }
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
                      data-customer-resend-consultation="${escapeHtml(request.id)}"
                    >
                      ${request.email_status === "sent" ? "Resend email" : "Send email"}
                    </button>
                  `
                  : ""
              }

              <span class="es-form-request-status ${escapeHtml(request.display_status)}">
                ${escapeHtml(customerFormRequestStatus(request.display_status))}
              </span>
            </div>
          </div>
        `
      )
      .join("");

  customerFormRequests
    .querySelectorAll(
      "[data-customer-resend-consultation]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            sendCustomerConsultationEmail(
              button.dataset
                .customerResendConsultation
            )
        );
      }
    );
}


async function generateCustomerFormLink() {
  if (!activeProfileCustomer) {
    return;
  }

  const templateId =
    customerFormTemplate.value;

  if (!templateId) {
    showCustomerFormStatus(
      "Choose a form first.",
      "error"
    );

    return;
  }

  const button =
    document.getElementById(
      "generateCustomerFormLinkButton"
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
              customer_id:
                activeProfileCustomer.id,
              appointment_id:
                customerFormAppointment.value ||
                null
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

    currentCustomerGeneratedFormRequest =
      data.request;

    customerGeneratedFormLink.value =
      `${location.origin}${data.request.url_path}`;

    customerGeneratedFormLinkWrap.hidden =
      false;

    showCustomerFormStatus(
      data.reused
        ? "Existing secure link ready to copy."
        : "Secure form link created.",
      "success"
    );

    await loadCustomerFormRequests();
  } catch (error) {
    showCustomerFormStatus(
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


function showCustomerFormStatus(
  message,
  type = ""
) {
  customerSendFormStatus.hidden =
    false;

  customerSendFormStatus.className =
    `es-status ${type}`.trim();

  customerSendFormStatus.textContent =
    message;
}


function customerFormRequestStatus(
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

function renderCustomerProfile(
  customer
) {

  activeProfileCustomer =
    customer;

  customerDrawerName.textContent =
    `${customer.first_name} ${customer.last_name}`;


  customerDrawerMeta.innerHTML = `
    <span class="es-customer-chip">
      Customer since
      ${formatDate(
        customer.created_at
      )}
    </span>

    ${
      customer.marketing_consent === 1
        ? `
          <span class="es-customer-chip">
            Marketing consent
          </span>
        `
        : ""
    }
  `;


  customerProfileStats.innerHTML = `
    ${profileStat(
      "Visits",
      customer.visit_count || 0
    )}

    ${profileStat(
      "Upcoming",
      customer.upcoming_count || 0
    )}

    ${profileStat(
      "Paid",
      formatMoney(
        customer.total_paid_minor
      )
    )}
  `;


  customerDetails.innerHTML = `
    ${detailItem(
      "Email",
      customer.email ||
      "—"
    )}

    ${detailItem(
      "Phone",
      customer.phone ||
      "—"
    )}

    ${detailItem(
      "Notes",
      customer.notes ||
      "No customer notes",
      true
    )}
  `;


  customerUpcomingBookings.innerHTML =
    renderAppointments(
      customer.upcoming_bookings,
      "No upcoming bookings."
    );


  customerBookingHistory.innerHTML =
    renderAppointments(
      customer.booking_history,
      "No previous bookings."
    );


  newCustomerBookingButton.href =
    `/bookings/?customer=${encodeURIComponent(
      customer.id
    )}`;
}


function profileStat(
  label,
  value
) {

  return `
    <div class="es-customer-profile-stat">
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>
    </div>
  `;
}


function detailItem(
  label,
  value,
  full = false
) {

  return `
    <div
      class="
        es-customer-detail
        ${
          full
            ? "es-customer-detail-full"
            : ""
        }
      "
    >
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>
    </div>
  `;
}


function renderAppointments(
  appointments,
  emptyMessage
) {

  const items =
    appointments ||
    [];


  if (
    items.length === 0
  ) {

    return `
      <div class="es-empty-state">
        <strong>
          ${escapeHtml(
            emptyMessage
          )}
        </strong>
      </div>
    `;
  }


  return items
    .map(
      (appointment) => `
        <div class="es-customer-appointment">

          <div class="es-customer-appointment-time">
            <strong>
              ${formatShortDate(
                appointment.start_at
              )}
            </strong>

            <span>
              ${formatTime(
                appointment.start_at
              )}
            </span>
          </div>

          <div class="es-customer-appointment-main">
            <strong>
              ${escapeHtml(
                appointment.service_name
              )}
            </strong>

            <small>
              ${formatMoney(
                appointment.price_minor
              )}
            </small>
          </div>

          <span
            class="
              es-customer-status
              es-customer-status-${escapeHtml(
                appointment.status
              )}
            "
          >
            ${escapeHtml(
              formatStatus(
                appointment.status
              )
            )}
          </span>

        </div>
      `
    )
    .join("");
}


function openCustomerDrawer() {

  customerDrawer
    .classList
    .add(
      "is-open"
    );


  customerDrawerBackdrop
    .classList
    .add(
      "is-open"
    );


  customerDrawer
    .setAttribute(
      "aria-hidden",
      "false"
    );
}


function closeCustomerDrawer() {

  customerDrawer
    .classList
    .remove(
      "is-open"
    );


  customerDrawerBackdrop
    .classList
    .remove(
      "is-open"
    );


  customerDrawer
    .setAttribute(
      "aria-hidden",
      "true"
    );
}


/* =======================================================
   Create / edit
   ======================================================= */

function openCustomerForm(
  customer = null
) {

  resetCustomerForm(
    false
  );


  if (customer) {

    customerId.value =
      customer.id;


    document
      .getElementById(
        "customerFormTitle"
      )
      .textContent =
        "Edit customer";


    saveCustomerButton.textContent =
      "Save changes";


    document
      .getElementById(
        "customerFirstName"
      )
      .value =
        customer.first_name ||
        "";


    document
      .getElementById(
        "customerLastName"
      )
      .value =
        customer.last_name ||
        "";


    document
      .getElementById(
        "customerEmail"
      )
      .value =
        customer.email ||
        "";


    document
      .getElementById(
        "customerPhone"
      )
      .value =
        customer.phone ||
        "";


    document
      .getElementById(
        "customerNotes"
      )
      .value =
        customer.notes ||
        "";


    document
      .getElementById(
        "marketingConsent"
      )
      .checked =
        customer
          .marketing_consent ===
        1;

  } else {

    document
      .getElementById(
        "customerFormTitle"
      )
      .textContent =
        "Add customer";


    saveCustomerButton.textContent =
      "Save customer";
  }


  customerFormPanel.hidden =
    false;


  customerFormPanel.scrollIntoView({
    behavior:
      "smooth",
    block:
      "start"
  });
}


function closeCustomerForm() {

  resetCustomerForm();
}


function resetCustomerForm(
  hidePanel = true
) {

  customerForm.reset();

  customerId.value =
    "";

  customerFormStatus.hidden =
    true;

  saveCustomerButton.disabled =
    false;

  document
    .getElementById(
      "customerFormTitle"
    )
    .textContent =
      "Add customer";

  saveCustomerButton.textContent =
    "Save customer";


  if (hidePanel) {

    customerFormPanel.hidden =
      true;
  }
}


customerForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const editing =
      Boolean(
        customerId.value
      );


    const payload = {
      id:
        customerId.value ||
        undefined,

      first_name:
        document
          .getElementById(
            "customerFirstName"
          )
          .value
          .trim(),

      last_name:
        document
          .getElementById(
            "customerLastName"
          )
          .value
          .trim(),

      email:
        document
          .getElementById(
            "customerEmail"
          )
          .value
          .trim(),

      phone:
        document
          .getElementById(
            "customerPhone"
          )
          .value
          .trim(),

      notes:
        document
          .getElementById(
            "customerNotes"
          )
          .value
          .trim(),

      marketing_consent:
        document
          .getElementById(
            "marketingConsent"
          )
          .checked
            ? 1
            : 0
    };


    if (
      !payload.first_name ||
      !payload.last_name
    ) {

      showFormError(
        "First and last name are required."
      );

      return;
    }


    customerFormStatus.hidden =
      false;

    customerFormStatus.className =
      "es-status";

    customerFormStatus.textContent =
      editing
        ? "Saving changes…"
        : "Creating customer…";


    saveCustomerButton.disabled =
      true;


    try {

      const response =
        await fetch(
          "/api/customers",
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
          "Unable to save customer."
        );
      }


      customerFormStatus.className =
        "es-status success";

      customerFormStatus.textContent =
        editing
          ? "Customer updated."
          : "Customer created.";


      await loadCustomers();


      setTimeout(
        () =>
          resetCustomerForm(),
        500
      );


    } catch (error) {

      showFormError(
        error.message ||
        "Unable to save customer."
      );


    } finally {

      saveCustomerButton.disabled =
        false;
    }
  }
);


function showFormError(
  message
) {

  customerFormStatus.hidden =
    false;

  customerFormStatus.className =
    "es-status error";

  customerFormStatus.textContent =
    message;
}


/* =======================================================
   Helpers
   ======================================================= */

function handleAuthentication(
  response
) {

  if (
    response.status === 401
  ) {

    window.location.href =
      "/auth/login.html";

    throw new Error(
      "Authentication required."
    );
  }
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

  if (!value) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",
      month:
        "short",
      year:
        "numeric"
    }
  ).format(
    new Date(value)
  );
}


function formatShortDate(value) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",
      month:
        "short"
    }
  ).format(
    new Date(value)
  );
}


function formatTime(value) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  ).format(
    new Date(value)
  );
}


function formatStatus(value) {

  const statuses = {
    pending:
      "Pending",
    confirmed:
      "Confirmed",
    completed:
      "Completed",
    cancelled:
      "Cancelled",
    no_show:
      "No show"
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

loadCustomers();

