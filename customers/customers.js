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

const customerTimeline =
  document.getElementById(
    "customerTimeline"
  );

const customerClinicalRecords =
  document.getElementById(
    "customerClinicalRecords"
  );

const customerTreatmentRecords =
  document.getElementById(
    "customerTreatmentRecords"
  );

const customerPhotos =
  document.getElementById(
    "customerPhotos"
  );

const newCustomerTreatmentButton =
  document.getElementById(
    "newCustomerTreatmentButton"
  );

const customerPhotoDialog =
  document.getElementById(
    "customerPhotoDialog"
  );

const customerPhotoForm =
  document.getElementById(
    "customerPhotoForm"
  );

const customerPhotoStatus =
  document.getElementById(
    "customerPhotoStatus"
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
    "sendCustomerFormInlineButton"
  )
  ?.addEventListener(
    "click",
    openCustomerFormRequest
  );


document
  .getElementById(
    "addCustomerPhotoButton"
  )
  ?.addEventListener(
    "click",
    openCustomerPhotoDialog
  );


document
  .getElementById(
    "closeCustomerPhotoDialog"
  )
  ?.addEventListener(
    "click",
    closeCustomerPhotoDialog
  );


document
  .getElementById(
    "cancelCustomerPhotoButton"
  )
  ?.addEventListener(
    "click",
    closeCustomerPhotoDialog
  );


customerPhotoForm
  ?.addEventListener(
    "submit",
    uploadCustomerPhoto
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

function renderCustomerTimeline(
  timeline
) {
  if (!timeline.length) {
    customerTimeline.innerHTML = `
      <div class="es-empty-state">
        <strong>No timeline activity yet.</strong>
        <span>Appointments and records will appear here as the customer history grows.</span>
      </div>
    `;
    return;
  }

  customerTimeline.innerHTML =
    timeline
      .slice(0, 30)
      .map(
        (item) => `
          <div class="es-customer-timeline-item">

            <div class="es-customer-timeline-date">
              ${escapeHtml(
                formatShortDate(
                  item.event_date
                )
              )}
            </div>

            <div class="es-customer-timeline-dot"></div>

            <div class="es-customer-timeline-content">
              <strong>
                ${escapeHtml(
                  timelineTitle(
                    item
                  )
                )}
              </strong>

              <span>
                ${escapeHtml(
                  [
                    item.service_name,
                    formatStatus(
                      item.subtitle
                    )
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}
              </span>
            </div>

          </div>
        `
      )
      .join("");
}


function timelineTitle(item) {
  const prefixes = {
    appointment:
      "Appointment",
    client_form:
      "Client form",
    patch_test:
      "Patch test",
    clinical_record:
      "Internal record",
    treatment_record:
      "Treatment record",
    photo:
      "Photo"
  };

  const prefix =
    prefixes[
      item.event_type
    ] ||
    "Record";

  return `${prefix} · ${
    item.title ||
    "Record"
  }`;
}


function renderCustomerClinicalRecords(
  records,
  formRequests
) {
  const outstanding =
    (
      formRequests ||
      []
    ).filter(
      (request) =>
        [
          "created",
          "opened"
        ].includes(
          request.status
        )
    );

  const rows = [];

  for (
    const request of
    outstanding
  ) {
    rows.push(`
      <div class="es-customer-record-row">
        <div class="es-customer-record-main">
          <strong>
            ${escapeHtml(
              request.template_name ||
              "Client form"
            )}
          </strong>

          <span>
            ${escapeHtml(
              [
                request.service_name,
                request.appointment_start_at
                  ? formatShortDate(
                      request.appointment_start_at
                    )
                  : null,
                "Action required"
              ]
                .filter(Boolean)
                .join(" · ")
            )}
          </span>
        </div>

        <div class="es-customer-record-actions">
          <span class="es-customer-status">
            Outstanding
          </span>
        </div>
      </div>
    `);
  }

  for (
    const record of
    records
  ) {
    rows.push(`
      <div class="es-customer-record-row">
        <div class="es-customer-record-main">
          <strong>
            ${escapeHtml(
              record.template_name ||
              "Clinical form"
            )}
          </strong>

          <span>
            ${escapeHtml(
              [
                formatTemplateType(
                  record.template_type
                ),
                record.service_name,
                formatShortDate(
                  record.submitted_at
                )
              ]
                .filter(Boolean)
                .join(" · ")
            )}
          </span>
        </div>

        <div class="es-customer-record-actions">
          <span class="es-customer-status">
            ${escapeHtml(
              formatStatus(
                record.status
              )
            )}
          </span>

          <a
            class="es-customer-action"
            href="/clinical-submissions/?record=${encodeURIComponent(
              record.id
            )}"
          >
            View
          </a>
        </div>
      </div>
    `);
  }

  customerClinicalRecords.innerHTML =
    rows.length
      ? rows.join("")
      : `
          <div class="es-empty-state">
            <strong>No forms or clinical records yet.</strong>
          </div>
        `;
}


function renderCustomerTreatmentRecords(
  records
) {
  if (!records.length) {
    customerTreatmentRecords.innerHTML = `
      <div class="es-empty-state">
        <strong>No treatment records yet.</strong>
      </div>
    `;
    return;
  }

  customerTreatmentRecords.innerHTML =
    records
      .map(
        (record) => `
          <div class="es-customer-record-row">
            <div class="es-customer-record-main">
              <strong>
                ${escapeHtml(
                  record.service_name ||
                  "Treatment record"
                )}
              </strong>

              <span>
                ${escapeHtml(
                  [
                    formatShortDate(
                      record.treatment_date
                    ),
                    record.treatment_area,
                    record.practitioner_name
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}
              </span>
            </div>

            <div class="es-customer-record-actions">
              <span class="es-customer-status">
                ${escapeHtml(
                  formatStatus(
                    record.status
                  )
                )}
              </span>

              <a
                class="es-customer-action"
                href="/treatment-records/?record=${encodeURIComponent(
                  record.id
                )}"
              >
                View
              </a>
            </div>
          </div>
        `
      )
      .join("");
}


function renderCustomerPhotos(
  photos
) {
  if (!photos.length) {
    customerPhotos.innerHTML = `
      <div
        class="es-empty-state"
        style="grid-column:1/-1;"
      >
        <strong>No customer photos yet.</strong>
        <span>Add before, after, progress or other record photos.</span>
      </div>
    `;
    return;
  }

  customerPhotos.innerHTML =
    photos
      .map(
        (photo) => `
          <article class="es-customer-photo-card">

            <a
              href="${escapeHtml(
                photo.content_url
              )}"
              target="_blank"
              rel="noopener"
            >
              <img
                src="${escapeHtml(
                  photo.content_url
                )}"
                alt="${escapeHtml(
                  `${formatPhotoType(
                    photo.photo_type
                  )} photo`
                )}"
                loading="lazy"
              >
            </a>

            <div class="es-customer-photo-meta">
              <strong>
                ${escapeHtml(
                  formatPhotoType(
                    photo.photo_type
                  )
                )}
              </strong>

              <span>
                ${escapeHtml(
                  [
                    photo.service_name,
                    formatShortDate(
                      photo.taken_at ||
                      photo.created_at
                    )
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}
              </span>

              ${
                photo.notes
                  ? `
                    <span>
                      ${escapeHtml(
                        photo.notes
                      )}
                    </span>
                  `
                  : ""
              }
            </div>

            <div class="es-customer-photo-actions">
              <a
                class="es-customer-action"
                href="${escapeHtml(
                  photo.content_url
                )}"
                target="_blank"
                rel="noopener"
              >
                Open
              </a>

              <button
                class="es-customer-action"
                type="button"
                data-delete-customer-photo="${escapeHtml(
                  photo.id
                )}"
              >
                Delete
              </button>
            </div>

          </article>
        `
      )
      .join("");

  customerPhotos
    .querySelectorAll(
      "[data-delete-customer-photo]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () =>
            deleteCustomerPhoto(
              button.dataset
                .deleteCustomerPhoto
            )
        );
      }
    );
}


function populateCustomerPhotoLinks(
  customer
) {
  const appointmentSelect =
    document.getElementById(
      "customerPhotoAppointment"
    );

  const treatmentSelect =
    document.getElementById(
      "customerPhotoTreatmentRecord"
    );

  const appointments = [
    ...(customer.upcoming_bookings || []),
    ...(customer.booking_history || [])
  ];

  appointmentSelect.innerHTML =
    `<option value="">Customer only — no appointment</option>` +
    appointments
      .map(
        (appointment) => `
          <option value="${escapeHtml(
            appointment.id
          )}">
            ${escapeHtml(
              `${formatShortDate(
                appointment.start_at
              )} · ${
                appointment.service_name
              }`
            )}
          </option>
        `
      )
      .join("");

  treatmentSelect.innerHTML =
    `<option value="">No treatment record</option>` +
    (
      customer.treatment_records ||
      []
    )
      .map(
        (record) => `
          <option value="${escapeHtml(
            record.id
          )}">
            ${escapeHtml(
              `${
                formatShortDate(
                  record.treatment_date
                )
              } · ${
                record.service_name ||
                "Treatment record"
              }`
            )}
          </option>
        `
      )
      .join("");
}


function openCustomerPhotoDialog() {
  if (!activeProfileCustomer) {
    return;
  }

  customerPhotoForm.reset();

  customerPhotoStatus.hidden =
    true;

  document
    .getElementById(
      "customerPhotoDialogTitle"
    )
    .textContent =
      `Add photo · ${
        activeProfileCustomer
          .first_name
      }`;

  if (
    typeof customerPhotoDialog
      .showModal ===
    "function"
  ) {
    customerPhotoDialog.showModal();
  }
}


function closeCustomerPhotoDialog() {
  if (
    customerPhotoDialog
      ?.open
  ) {
    customerPhotoDialog.close();
  }
}


async function uploadCustomerPhoto(
  event
) {
  event.preventDefault();

  if (!activeProfileCustomer) {
    return;
  }

  const button =
    document.getElementById(
      "saveCustomerPhotoButton"
    );

  const file =
    document.getElementById(
      "customerPhotoFile"
    ).files?.[0];

  if (!file) {
    showCustomerPhotoStatus(
      "Choose a photo first.",
      "error"
    );
    return;
  }

  button.disabled = true;
  button.textContent =
    "Uploading…";

  try {
    const formData =
      new FormData();

    formData.append(
      "customer_id",
      activeProfileCustomer.id
    );

    formData.append(
      "photo",
      file
    );

    formData.append(
      "photo_type",
      document.getElementById(
        "customerPhotoType"
      ).value
    );

    formData.append(
      "taken_at",
      document.getElementById(
        "customerPhotoDate"
      ).value
    );

    formData.append(
      "appointment_id",
      document.getElementById(
        "customerPhotoAppointment"
      ).value
    );

    formData.append(
      "treatment_record_id",
      document.getElementById(
        "customerPhotoTreatmentRecord"
      ).value
    );

    formData.append(
      "notes",
      document.getElementById(
        "customerPhotoNotes"
      ).value
    );

    const response =
      await fetch(
        "/api/customer-photos",
        {
          method:
            "POST",
          body:
            formData
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
        "Unable to upload photo."
      );
    }

    closeCustomerPhotoDialog();

    await loadCustomerProfile(
      activeProfileCustomer.id
    );
  } catch (error) {
    showCustomerPhotoStatus(
      error.message ||
      "Unable to upload photo.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent =
      "Upload photo";
  }
}


async function deleteCustomerPhoto(
  photoId
) {
  if (
    !confirm(
      "Delete this customer photo? This removes the stored image from this installation."
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/customer-photos",
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              photo_id:
                photoId
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
        "Unable to delete photo."
      );
    }

    await loadCustomerProfile(
      activeProfileCustomer.id
    );
  } catch (error) {
    alert(
      error.message ||
      "Unable to delete photo."
    );
  }
}


function showCustomerPhotoStatus(
  message,
  type = ""
) {
  customerPhotoStatus.hidden =
    false;

  customerPhotoStatus.className =
    `es-status ${type}`.trim();

  customerPhotoStatus.textContent =
    message;
}


function formatTemplateType(
  value
) {
  return {
    consultation:
      "Consultation",
    patch_test:
      "Patch test",
    treatment_record:
      "Treatment record",
    custom:
      "Custom"
  }[value] ||
  formatStatus(value);
}


function formatPhotoType(
  value
) {
  return {
    before:
      "Before",
    after:
      "After",
    progress:
      "Progress",
    consultation:
      "Consultation",
    patch_test:
      "Patch test",
    other:
      "Other"
  }[value] ||
  formatStatus(value);
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


  renderCustomerTimeline(
    customer.timeline ||
    []
  );


  renderCustomerClinicalRecords(
    customer.clinical_records ||
    [],
    customer.form_requests ||
    []
  );


  renderCustomerTreatmentRecords(
    customer.treatment_records ||
    []
  );


  renderCustomerPhotos(
    customer.photos ||
    []
  );


  populateCustomerPhotoLinks(
    customer
  );


  newCustomerTreatmentButton.href =
    `/treatment-records/?customer=${encodeURIComponent(
      customer.id
    )}`;


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


      await loadCustomers().then(() => {
  const customerParam =
    new URLSearchParams(
      location.search
    ).get(
      "customer"
    );

  if (customerParam) {
    loadCustomerProfile(
      customerParam
    );
  }
});


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

