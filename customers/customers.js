const customersList =
  document.getElementById(
    "customersList"
  );

const customerSearch =
  document.getElementById(
    "customerSearch"
  );


const customerHubTotalCustomers =
  document.getElementById("customerHubTotalCustomers");

const customerHubTreatmentRecords =
  document.getElementById("customerHubTreatmentRecords");

const customerHubNeedsDetails =
  document.getElementById("customerHubNeedsDetails");

const customerHubFollowups =
  document.getElementById("customerHubFollowups");

const customerHubAttentionCount =
  document.getElementById("customerHubAttentionCount");

const customerHubAttentionList =
  document.getElementById("customerHubAttentionList");

const customerHubRecentList =
  document.getElementById("customerHubRecentList");

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

const customerPackages =
  document.getElementById(
    "customerPackages"
  );


const customerPayments =
  document.getElementById(
    "customerPayments"
  );


const customerPaymentsToggleWrap =
  document.getElementById(
    "customerPaymentsToggleWrap"
  );

const toggleFailedCustomerPayments =
  document.getElementById(
    "toggleFailedCustomerPayments"
  );


const customerCommunications =
  document.getElementById(
    "customerCommunications"
  );


const customerClinicalRecords =
  document.getElementById(
    "customerClinicalRecords"
  );


const customerInlineFormStatus =
  document.getElementById(
    "customerInlineFormStatus"
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
let customerHubTreatmentRecordsData = [];
let customerHubFilter = "all";
let showFailedCustomerPayments = false;

let activeProfileCustomer = null;
let currentCustomerGeneratedFormRequest = null;
let currentCustomerFormTemplates = [];

let customerPhotoPreviewUrls = [];
let customerPhotoCompareSelection = null;

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


document
  .querySelectorAll("[data-customer-hub-filter]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      customerHubFilter = button.dataset.customerHubFilter || "all";

      document
        .querySelectorAll("[data-customer-hub-filter]")
        .forEach((item) => {
          item.classList.toggle(
            "active",
            item.dataset.customerHubFilter === customerHubFilter
          );
        });

      renderCustomers();
    });
  });


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


    if (customerHubTotalCustomers) {
      customerHubTotalCustomers.textContent = customers.length;
    }


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

        const customerRecordRows =
          customerHubTreatmentRecordsData.filter(
            (record) => record.customer_id === customer.id
          );

        if (
          customerHubFilter === "attention" &&
          !customerRecordRows.some((record) => record.status === "draft")
        ) {
          return false;
        }

        if (
          customerHubFilter === "followup" &&
          !customerRecordRows.some((record) => Boolean(record.next_treatment_date))
        ) {
          return false;
        }

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
   Customers hub — read-only clinical overview
   ======================================================= */

async function loadCustomerClinicalOverview() {

  try {

    const response =
      await fetch(
        "/api/treatment-records",
        {
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );


    handleAuthentication(response);


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to load clinical overview."
      );
    }


    customerHubTreatmentRecordsData =
      data.records ||
      [];


    renderCustomerClinicalOverview(
      data.stats ||
      {}
    );

    renderCustomers();


  } catch (error) {

    if (customerHubAttentionList) {
      customerHubAttentionList.innerHTML = `
        <div class="es-status error">
          ${escapeHtml(error.message || "Unable to load clinical records.")}
        </div>
      `;
    }

    if (customerHubRecentList) {
      customerHubRecentList.innerHTML = `
        <div class="es-status error">
          Clinical history is unavailable.
        </div>
      `;
    }
  }
}


function renderCustomerClinicalOverview(stats) {

  if (customerHubTreatmentRecords) {
    customerHubTreatmentRecords.textContent =
      stats.total_records ||
      customerHubTreatmentRecordsData.length ||
      0;
  }

  if (customerHubNeedsDetails) {
    customerHubNeedsDetails.textContent =
      stats.draft_records ||
      customerHubTreatmentRecordsData.filter(
        (record) => record.status === "draft"
      ).length;
  }

  if (customerHubFollowups) {
    customerHubFollowups.textContent =
      stats.followup_records ||
      customerHubTreatmentRecordsData.filter(
        (record) => Boolean(record.next_treatment_date)
      ).length;
  }


  const needsAttention =
    customerHubTreatmentRecordsData
      .filter((record) => record.status === "draft")
      .sort(
        (a, b) =>
          customerHubRecordDateValue(b) -
          customerHubRecordDateValue(a)
      );


  if (customerHubAttentionCount) {
    customerHubAttentionCount.textContent =
      needsAttention.length;
  }


  if (customerHubAttentionList) {

    if (needsAttention.length === 0) {

      customerHubAttentionList.innerHTML = `
        <div class="es-empty-state">
          <strong>No treatment records need attention.</strong>
          <span>Incomplete records will appear here automatically.</span>
        </div>
      `;

    } else {

      customerHubAttentionList.innerHTML =
        needsAttention
          .slice(0, 4)
          .map(
            (record) =>
              customerHubRecordCard(
                record,
                "needs"
              )
          )
          .join("");
    }
  }


  const recent =
    [...customerHubTreatmentRecordsData]
      .sort(
        (a, b) =>
          customerHubRecordDateValue(b) -
          customerHubRecordDateValue(a)
      )
      .slice(0, 5);


  if (customerHubRecentList) {

    if (recent.length === 0) {

      customerHubRecentList.innerHTML = `
        <div class="es-empty-state">
          <strong>No treatment records yet.</strong>
          <span>Records created from customer profiles will appear here.</span>
        </div>
      `;

    } else {

      customerHubRecentList.innerHTML =
        recent
          .map(
            (record) =>
              customerHubRecordCard(
                record,
                record.status === "draft"
                  ? "needs"
                  : "complete"
              )
          )
          .join("");
    }
  }


  document
    .querySelectorAll(
      "[data-customer-hub-open]"
    )
    .forEach(
      (link) => {

        link.addEventListener(
          "click",
          (event) => {
            event.preventDefault();

            loadCustomerProfile(
              link.dataset
                .customerHubOpen
            );
          }
        );
      }
    );
}


function customerHubRecordCard(
  record,
  statusKind
) {

  const customerName =
    `${record.first_name || ""} ${record.last_name || ""}`
      .trim() ||
      "Customer";

  const serviceName =
    record.service_name ||
    "Treatment";

  const recordDate =
    record.treatment_date
      ? formatDate(record.treatment_date)
      : "No date";

  const statusLabel =
    statusKind === "needs"
      ? "Needs details"
      : "Complete";

  return `
    <article class="es-customer-hub-record">
      <div class="es-customer-hub-record-main">
        <span class="es-customer-hub-status es-customer-hub-status-${statusKind}">
          ${statusLabel}
        </span>
        <strong>${escapeHtml(customerName)}</strong>
        <span>${escapeHtml(serviceName)} · ${escapeHtml(recordDate)}</span>
      </div>

      <a
        class="es-customer-hub-record-action"
        href="/customers/?customer=${encodeURIComponent(record.customer_id)}"
        data-customer-hub-open="${escapeHtml(record.customer_id)}"
      >
        Open customer
      </a>
    </article>
  `;
}


function customerHubRecordDateValue(record) {

  const value =
    record.treatment_date ||
    record.created_at ||
    "";

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
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


toggleFailedCustomerPayments
  ?.addEventListener(
    "click",
    () => {
      showFailedCustomerPayments =
        !showFailedCustomerPayments;

      if (activeProfileCustomer) {
        renderCustomerPayments(
          activeProfileCustomer.payments ||
          [],
          activeProfileCustomer.financial_summary ||
          {}
        );
      }
    }
  );


document
  .getElementById("customerPhotoFile")
  ?.addEventListener(
    "change",
    renderSelectedCustomerPhotos
  );


document
  .getElementById("closeCustomerPhotoCompareDialog")
  ?.addEventListener(
    "click",
    () => {
      document.getElementById("customerPhotoCompareDialog")?.close();
      customerPhotoCompareSelection = null;
    }
  );



document
  .getElementById(
    "customerPhotoTreatmentRecord"
  )
  ?.addEventListener(
    "change",
    validateCustomerPhotoLinks
  );


document
  .getElementById(
    "customerPhotoAppointment"
  )
  ?.addEventListener(
    "change",
    validateCustomerPhotoLinks
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
      data.duplicate || data.skipped
        ? "This form email has already been sent."
        : "Consultation email sent successfully.",
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
      `Add form or record for ${activeProfileCustomer.first_name}`;

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

    currentCustomerFormTemplates = [
      ...(data.templates || []).map(template => ({
        ...template,
        record_mode: "client"
      })),
      ...(data.internal_templates || []).map(template => ({
        ...template,
        record_mode: "internal"
      }))
    ];

    const clientTemplates = currentCustomerFormTemplates.filter(
      template => template.record_mode === "client"
    );

    const internalTemplates = currentCustomerFormTemplates.filter(
      template => template.record_mode === "internal"
    );

    customerFormTemplate.innerHTML =
      `<option value="">Choose a form or record</option>` +
      (clientTemplates.length
        ? `<optgroup label="Client forms">${clientTemplates.map(
            template => `
              <option value="${escapeHtml(template.id)}" data-mode="client">
                ${escapeHtml(template.name)}
              </option>
            `
          ).join("")}</optgroup>`
        : "") +
      (internalTemplates.length
        ? `<optgroup label="Internal records">${internalTemplates.map(
            template => `
              <option value="${escapeHtml(template.id)}" data-mode="internal">
                ${escapeHtml(template.name)}
              </option>
            `
          ).join("")}</optgroup>`
        : "");

    if (!currentCustomerFormTemplates.length) {
      showCustomerFormStatus(
        "Add or activate at least one Clinical Template before creating a form or record.",
        "error"
      );
    }

    updateCustomerFormActionMode();

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
                  String(request.request_token || "").startsWith("fri_")
                    ? "Internal clinical record"
                    : request.email_status === "sent"
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
                  ? String(request.request_token || "").startsWith("fri_")
                    ? `
                      <a
                        class="es-secondary-button"
                        href="/forms/view.html?request_token=${encodeURIComponent(request.request_token)}"
                        target="_blank"
                        rel="noopener"
                      >
                        Open record
                      </a>
                    `
                    : `
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


function selectedCustomerFormTemplate() {
  const templateId = customerFormTemplate.value;

  return currentCustomerFormTemplates.find(
    template => String(template.id) === String(templateId)
  ) || null;
}


function updateCustomerFormActionMode() {
  const template = selectedCustomerFormTemplate();
  const button = document.getElementById(
    "generateCustomerFormLinkButton"
  );

  if (!button) return;

  button.textContent =
    template?.record_mode === "internal"
      ? "Open record"
      : "Generate secure link";

  customerGeneratedFormLinkWrap.hidden = true;
  currentCustomerGeneratedFormRequest = null;
}


customerFormTemplate?.addEventListener(
  "change",
  updateCustomerFormActionMode
);


async function generateCustomerFormLink() {
  if (!activeProfileCustomer) {
    return;
  }

  const templateId =
    customerFormTemplate.value;

  const selectedTemplate =
    selectedCustomerFormTemplate();

  if (!templateId || !selectedTemplate) {
    showCustomerFormStatus(
      "Choose a form or record first.",
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
                null,
              internal:
                selectedTemplate.record_mode ===
                "internal"
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

    if (
      selectedTemplate.record_mode ===
      "internal"
    ) {
      showCustomerFormStatus(
        `${selectedTemplate.name} opened as an internal record.`,
        "success"
      );

      window.open(
        customerGeneratedFormLink.value,
        "_blank",
        "noopener"
      );

      await loadCustomerFormRequests();
      return;
    }

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

    button.textContent = selectedCustomerFormTemplate()?.record_mode === "internal" ? "Open record" : "Generate secure link";
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
                  timelineMeta(
                    item
                  )
                )}
              </span>

              ${timelineAction(item)}
            </div>

          </div>
        `
      )
      .join("");
}


function timelineMeta(
  item
) {
  const serviceMeta =
    (
      item.booking_kind ===
        "consultation" ||
      item.appointment_booking_kind ===
        "consultation"
    )
      ? (
          item.service_name
            ? `Consultation · ${
                item.service_name
              }`
            : "Consultation"
        )
      : item.service_name;

  const parts = [
    serviceMeta,
    item.event_type ===
      "payment"
      ? formatMoney(
          item.amount_minor
        )
      : null,
    formatStatus(
      item.subtitle
    )
  ];

  return parts
    .filter(Boolean)
    .join(" · ");
}


function timelineAction(
  item
) {
  if (
    item.event_type ===
      "client_form" ||
    item.event_type ===
      "patch_test" ||
    item.event_type ===
      "clinical_record"
  ) {
    return `
      <a
        class="es-customer-action"
        href="/clinical-submissions/?record=${encodeURIComponent(
          item.record_id
        )}"
      >
        View record
      </a>
    `;
  }

  if (
    item.event_type ===
      "treatment_record"
  ) {
    return `
      <a
        class="es-customer-action"
        href="/treatment-records/?record=${encodeURIComponent(
          item.record_id
        )}"
      >
        View treatment
      </a>
    `;
  }

  if (
    item.event_type ===
      "photo" &&
    item.content_url
  ) {
    return `
      <a
        class="es-customer-action"
        href="${escapeHtml(
          item.content_url
        )}"
        target="_blank"
        rel="noopener"
      >
        Open photo
      </a>
    `;
  }

  if (
    item.event_type ===
      "appointment" ||
    item.event_type ===
      "package_session"
  ) {
    return `
      <a
        class="es-customer-action"
        href="/bookings/?booking=${encodeURIComponent(
          item.appointment_id
        )}"
      >
        View booking
      </a>
    `;
  }

  return "";
}


function timelineTitle(item) {
  const prefixes = {
    appointment:
      "Appointment",
    package_session:
      "Package session",
    form_request:
      "Form required",
    payment:
      "Payment",
    client_form:
      "Client form",
    patch_test:
      "Patch test",
    clinical_record:
      "Internal record",
    treatment_record:
      "Treatment record",
    photo:
      "Photo",
    package:
      "Package"
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


function renderCustomerPackages(
  packages
) {
  if (!packages.length) {
    customerPackages.innerHTML = `
      <div class="es-empty-state">
        <strong>No packages or courses yet.</strong>
      </div>
    `;
    return;
  }

  customerPackages.innerHTML =
    packages
      .map(
        (item) => `
          <div class="es-customer-package-row">
            <div class="es-customer-package-head">
              <div>
                <strong>
                  ${escapeHtml(
                    item.name_snapshot
                  )}
                </strong>

                <div class="es-customer-package-meta">
                  <span>${escapeHtml(
                    item.service_name
                  )}</span>
                  <span>${item.sessions_completed}/${item.sessions_total} completed</span>
                  <span>${item.sessions_booked} booked</span>
                  <span>${item.sessions_available_to_book} available</span>
                </div>
              </div>

              <span class="es-customer-status">
                ${escapeHtml(
                  formatStatus(
                    item.status
                  )
                )}
              </span>
            </div>

            <div class="es-customer-package-meta">
              <span>Value ${formatMoney(item.price_minor)}</span>
              <span>Paid ${formatMoney(item.paid_minor)}</span>
              ${Number(item.consultation_credit_minor || 0) > 0
                ? `<span>Consultation credit ${formatMoney(item.consultation_credit_minor)}</span>`
                : ""}
              <span>Outstanding ${formatMoney(item.outstanding_minor)}</span>
            </div>

            ${
              (item.sessions || []).length
                ? `
                  <div class="es-customer-package-sessions">
                    ${
                      item.sessions
                        .map(
                          (session) => `
                            <div class="es-customer-package-session">
                              <strong>
                                Session ${session.session_number}/${item.sessions_total}
                              </strong>

                              <span>
                                ${escapeHtml(
                                  `${formatShortDate(
                                    session.start_at
                                  )} · ${formatTime(
                                    session.start_at
                                  )}`
                                )}
                              </span>

                              <a
                                class="es-customer-action"
                                href="/bookings/?booking=${encodeURIComponent(
                                  session.appointment_id
                                )}"
                              >
                                ${escapeHtml(
                                  formatStatus(
                                    session.status
                                  )
                                )}
                              </a>
                            </div>
                          `
                        )
                        .join("")
                    }
                  </div>
                `
                : ""
            }

            ${
              item.status === "active" &&
              Number(
                item.sessions_available_to_book ||
                0
              ) > 0
                ? `
                  <div class="es-customer-package-actions">
                    <a
                      class="es-customer-action"
                      href="/bookings/?package=${encodeURIComponent(
                        item.id
                      )}"
                    >
                      Book next session
                    </a>
                  </div>
                `
                : ""
            }
          </div>
        `
      )
      .join("");
}


function renderCustomerPayments(
  payments,
  financialSummary
) {
  const summary =
    financialSummary ||
    {};

  const allPayments =
    payments ||
    [];

  const failedPayments =
    allPayments.filter(
      (payment) =>
        payment.status ===
        "failed"
    );

  const visiblePayments =
    showFailedCustomerPayments
      ? allPayments
      : allPayments.filter(
          (payment) =>
            payment.status !==
            "failed"
        );

  const summaryHtml = `
    <div class="es-customer-record-row">
      <div class="es-customer-record-main">
        <strong>Customer balance summary</strong>
        <span>
          Package balance ${formatMoney(
            summary.package_outstanding_minor ||
            0
          )} · Appointment balance ${formatMoney(
            summary.appointment_outstanding_minor ||
            0
          )}
        </span>
      </div>

      <div class="es-customer-record-actions">
        <strong>
          ${formatMoney(
            summary.total_outstanding_minor ||
            0
          )} outstanding
        </strong>
      </div>
    </div>
  `;

  if (
    customerPaymentsToggleWrap &&
    toggleFailedCustomerPayments
  ) {
    customerPaymentsToggleWrap.hidden =
      failedPayments.length === 0;

    toggleFailedCustomerPayments.textContent =
      showFailedCustomerPayments
        ? "Hide failed attempts"
        : `Show failed attempts${
            failedPayments.length
              ? ` (${failedPayments.length})`
              : ""
          }`;
  }

  if (!visiblePayments.length) {
    customerPayments.innerHTML =
      summaryHtml +
      `
        <div class="es-empty-state">
          <strong>No successful or refundable payments recorded yet.</strong>
        </div>
      `;
    return;
  }

  customerPayments.innerHTML =
    summaryHtml +
    visiblePayments
      .map(
        (payment) => `
          <div class="es-customer-payment-row">
            <div class="es-customer-payment-main">
              <strong>
                ${escapeHtml(
                  payment.customer_package_id
                    ? `Package · ${
                        payment.package_name ||
                        "Package"
                      }`
                    : (
                        payment.appointment_booking_kind === "consultation" &&
                        payment.service_name
                          ? `Consultation · ${payment.service_name}`
                          : (
                              payment.service_name ||
                              (
                                payment.payment_type === "refund"
                                  ? "Customer refund"
                                  : "Customer payment"
                              )
                            )
                      )
                )}
              </strong>

              <div class="es-customer-payment-meta">
                <span>
                  ${escapeHtml(
                    formatShortDate(
                      payment.created_at
                    )
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    formatStatus(
                      payment.payment_type
                    )
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    formatStatus(
                      payment.status
                    )
                  )}
                </span>
              </div>
            </div>

            <div class="es-customer-payment-amount">
              <strong>
                ${
                  payment.payment_type ===
                    "refund"
                    ? "−"
                    : ""
                }${formatMoney(
                  Math.abs(
                    Number(
                      payment.amount_minor ||
                      0
                    )
                  )
                )}
              </strong>

              ${
                payment.appointment_id
                  ? `
                    <div class="es-customer-payment-actions">
                      ${
                        !payment.customer_package_id &&
                        Number(
                          payment.appointment_outstanding_minor ||
                          0
                        ) > 0
                          ? `
                            <a
                              class="es-customer-action es-customer-take-payment"
                              href="/payments/?take=1&appointment_id=${encodeURIComponent(
                                payment.appointment_id
                              )}"
                            >
                              Take payment
                            </a>
                          `
                          : ""
                      }

                      <a
                        class="es-customer-action"
                        href="/bookings/?booking=${encodeURIComponent(
                          payment.appointment_id
                        )}"
                      >
                        Booking
                      </a>
                    </div>
                  `
                  : ""
              }
            </div>
          </div>
        `
      )
      .join("");
}


function customerCommunicationLabel(
  type
) {
  return {
    booking_confirmation:
      "Booking confirmation",
    appointment_reminder:
      "Appointment reminder",
    cancellation_confirmation:
      "Cancellation",
    reschedule_confirmation:
      "Appointment updated",
    client_form_request:
      "Client form sent",
    client_form_reminder:
      "Client form reminder",
    payment_link:
      "Payment link",
    payment_receipt:
      "Payment confirmation",
    package_payment_confirmation:
      "Package payment confirmation",
    treatment_aftercare:
      "Treatment aftercare"
  }[type] ||
  formatStatus(
    type
  );
}


function renderCustomerCommunications(
  communications
) {
  const items =
    communications ||
    [];

  if (!items.length) {
    customerCommunications.innerHTML = `
      <div class="es-empty-state">
        <strong>No communication history yet.</strong>
      </div>
    `;
    return;
  }

  customerCommunications.innerHTML =
    items
      .slice(
        0,
        12
      )
      .map(
        (item) => `
          <div class="es-customer-record-row">
            <div class="es-customer-record-main">
              <strong>
                ${escapeHtml(
                  customerCommunicationLabel(
                    item.communication_type
                  )
                )}
              </strong>

              <span>
                ${escapeHtml(
                  [
                    item.package_name,
                    item.form_name,
                    item.service_name,
                    formatShortDate(
                      item.sent_at ||
                      item.created_at
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
                    item.status
                  )
                )}
              </span>
            </div>
          </div>
        `
      )
      .join("");
}


function visibleOutstandingFormRequests(formRequests) {
  const rawOutstanding =
    (formRequests || []).filter(
      request => {
        const token =
          String(
            request.request_token ||
            ""
          );

        const isInternalRecord =
          token.startsWith(
            "fri_"
          );

        return (
          !isInternalRecord &&
          ["created", "opened"].includes(
            request.status
          )
        );
      }
    );

  const seenActiveConsultations =
    new Set();

  return rawOutstanding.filter(
    request => {
      if (
        request.template_type !==
        "consultation"
      ) {
        return true;
      }

      const key =
        "active-consultation";

      if (
        seenActiveConsultations.has(
          key
        )
      ) {
        return false;
      }

      seenActiveConsultations.add(
        key
      );

      return true;
    }
  );
}


function renderCustomerClinicalRecords(

  records,
  formRequests
) {
  const outstanding =
    visibleOutstandingFormRequests(formRequests);

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
          <span class="es-customer-traffic es-customer-traffic-red">
            Outstanding
          </span>

          <button
            class="es-customer-action"
            type="button"
            data-copy-form-request="${escapeHtml(
              request.id
            )}"
            data-form-request-token="${escapeHtml(
              request.request_token ||
              ""
            )}"
          >
            Copy link
          </button>

          <button
            class="es-customer-action"
            type="button"
            data-remind-form-request="${escapeHtml(
              request.id
            )}"
          >
            Send reminder
          </button>
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
          <span class="es-customer-traffic es-customer-traffic-green">
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

  bindOutstandingFormActions();
}


function showCustomerInlineFormStatus(
  message,
  type = ""
) {
  if (!customerInlineFormStatus) {
    return;
  }

  customerInlineFormStatus.hidden =
    false;

  customerInlineFormStatus.className =
    `es-status ${type}`.trim();

  customerInlineFormStatus.textContent =
    message;

  window.clearTimeout(
    showCustomerInlineFormStatus.timer
  );

  showCustomerInlineFormStatus.timer =
    window.setTimeout(
      () => {
        customerInlineFormStatus.hidden =
          true;
      },
      4500
    );
}


function bindOutstandingFormActions() {
  customerClinicalRecords
    .querySelectorAll(
      "[data-copy-form-request]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            const token =
              button.dataset
                .formRequestToken ||
              "";

            if (!token) {
              showCustomerInlineFormStatus(
                "This form link could not be found.",
                "error"
              );
              return;
            }

            const url =
              `${location.origin}/forms/view.html?request_token=${encodeURIComponent(
                token
              )}`;

            try {
              await navigator
                .clipboard
                .writeText(url);

              showCustomerInlineFormStatus(
                "Secure form link copied.",
                "success"
              );
            } catch {
              window.prompt(
                "Copy this secure form link:",
                url
              );
            }
          }
        );
      }
    );


  customerClinicalRecords
    .querySelectorAll(
      "[data-remind-form-request]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            const requestId =
              button.dataset
                .remindFormRequest;

            const originalText =
              button.textContent;

            button.disabled =
              true;

            button.textContent =
              "Sending…";

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
                          requestId,
                        reminder:
                          true
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
                  "Unable to send form reminder."
                );
              }

              showCustomerInlineFormStatus(
                data.skipped ||
                data.duplicate
                  ? "A reminder has already been sent for this form."
                  : "Form reminder sent.",
                "success"
              );
            } catch (error) {
              showCustomerInlineFormStatus(
                error.message ||
                "Unable to send form reminder.",
                "error"
              );
            } finally {
              button.disabled =
                false;

              button.textContent =
                originalText;
            }
          }
        );
      }
    );
}


function treatmentRecordCompleteness(record) {
  const keyFields = [
    record.treatment_date,
    record.practitioner_name,
    record.treatment_area,
    record.treatment_notes
  ];
  const completeCount = keyFields.filter((value) => String(value || "").trim()).length;
  return completeCount >= 4 || record.status === "complete";
}

function renderCustomerTreatmentRecords(
  records
) {
  if (!records.length) {
    customerTreatmentRecords.innerHTML = `
      <div class="es-empty-state">
        <strong>No treatment records yet.</strong>
        <span>Create a record from a treatment appointment when you need one.</span>
      </div>
    `;
    return;
  }

  const photos = activeProfileCustomer?.photos || [];

  customerTreatmentRecords.innerHTML = records
    .map((record, index) => {
      const recordPhotos = photos.filter(
        (photo) => String(photo.treatment_record_id || "") === String(record.id)
      );
      const isComplete = treatmentRecordCompleteness(record);
      const appointmentLabel = record.appointment_id ? "Linked to appointment" : "No appointment linked";

      return `
        <article class="es-customer-treatment-card">
          <button
            class="es-customer-treatment-card-head"
            type="button"
            data-toggle-treatment-record="${index}"
            aria-expanded="false"
          >
            <span class="es-customer-treatment-card-title">
              <strong>${escapeHtml(record.service_name || "Treatment record")}</strong>
              <small>${escapeHtml([
                formatDate(record.treatment_date),
                appointmentLabel
              ].filter(Boolean).join(" · "))}</small>
            </span>
            <span class="es-customer-treatment-card-summary">
              <span class="es-customer-traffic ${isComplete ? "es-customer-traffic-green" : "es-customer-traffic-amber"}">
                ${isComplete ? "Complete" : "Needs details"}
              </span>
              <span class="es-customer-treatment-chevron">⌄</span>
            </span>
          </button>

          <div class="es-customer-treatment-card-body" data-treatment-record-body="${index}" hidden>
            <div class="es-customer-treatment-facts">
              <span><b>Practitioner</b>${escapeHtml(record.practitioner_name || "Not recorded")}</span>
              <span><b>Status</b>${escapeHtml(formatStatus(record.status))}</span>
              <span><b>Photos</b>${recordPhotos.length}</span>
              <span><b>Next treatment</b>${escapeHtml(record.next_treatment_date ? formatShortDate(record.next_treatment_date) : "Not set")}</span>
            </div>

            ${recordPhotos.length ? `
              <div class="es-customer-treatment-photo-strip">
                ${recordPhotos.slice(0, 4).map((photo) => `
                  <a href="${escapeHtml(photo.content_url)}" target="_blank" rel="noopener">
                    <img src="${escapeHtml(photo.content_url)}" alt="${escapeHtml(formatPhotoType(photo.photo_type))} treatment photo">
                  </a>
                `).join("")}
              </div>
            ` : ""}

            <div class="es-customer-treatment-card-actions">
              <a class="es-customer-action" href="/treatment-records/?record=${encodeURIComponent(record.id)}">View / edit</a>
              <button class="es-customer-action" type="button" data-add-photo-to-record="${escapeHtml(record.id)}" data-appointment-id="${escapeHtml(record.appointment_id || "")}">Add photo</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  customerTreatmentRecords.querySelectorAll("[data-toggle-treatment-record]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = button.dataset.toggleTreatmentRecord;
      const body = customerTreatmentRecords.querySelector(`[data-treatment-record-body="${index}"]`);
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", open ? "false" : "true");
      if (body) body.hidden = open;
    });
  });

  customerTreatmentRecords.querySelectorAll("[data-add-photo-to-record]").forEach((button) => {
    button.addEventListener("click", () => {
      openCustomerPhotoDialog();
      const appointmentSelect = document.getElementById("customerPhotoAppointment");
      const treatmentSelect = document.getElementById("customerPhotoTreatmentRecord");
      if (appointmentSelect && button.dataset.appointmentId) {
        appointmentSelect.value = button.dataset.appointmentId;
      }
      if (treatmentSelect) {
        treatmentSelect.value = button.dataset.addPhotoToRecord;
      }
    });
  });
}


function customerPhotoGroupKey(photo) {
  if (photo.appointment_id) {
    return `appointment__${photo.appointment_id}`;
  }

  const date = String(
    photo.taken_at ||
    photo.appointment_start_at ||
    photo.created_at ||
    ""
  ).slice(0, 10);

  return `${photo.service_name || "Customer photos"}__${date}`;
}

function openCustomerPhotoCompare(beforePhotos, afterPhotos, label) {
  customerPhotoCompareSelection = {
    beforePhotos,
    afterPhotos,
    label
  };

  const dialog = document.getElementById("customerPhotoCompareDialog");
  const title = document.getElementById("customerPhotoCompareTitle");
  const beforeList = document.getElementById("customerPhotoCompareBeforeList");
  const afterList = document.getElementById("customerPhotoCompareAfterList");

  if (!dialog || !beforeList || !afterList) return;

  title.textContent = label || "Photo comparison";

  const renderComparePhotos = (photos, labelText) =>
    (photos || [])
      .map(
        (photo, index) => `
          <a
            href="${escapeHtml(photo.content_url)}"
            target="_blank"
            rel="noopener"
            aria-label="Open ${escapeHtml(labelText)} photo ${index + 1}"
          >
            <img
              src="${escapeHtml(photo.content_url)}"
              alt="${escapeHtml(`${labelText} photo ${index + 1}`)}"
            >
          </a>
        `
      )
      .join("");

  beforeList.innerHTML =
    renderComparePhotos(
      beforePhotos,
      "Before"
    );

  afterList.innerHTML =
    renderComparePhotos(
      afterPhotos,
      "After"
    );

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  }
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

  const counts = photos.reduce(
    (result, photo) => {
      const type = photo.photo_type || "other";
      result[type] = (result[type] || 0) + 1;
      return result;
    },
    {}
  );

  const groups = new Map();

  photos.forEach((photo) => {
    const key = customerPhotoGroupKey(photo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(photo);
  });

  const summary = `
    <div class="es-customer-photo-summary">
      <span class="es-photo-count-pill">${counts.before || 0} Before</span>
      <span class="es-photo-count-pill">${counts.after || 0} After</span>
      <span class="es-photo-count-pill">${counts.progress || 0} Progress</span>
      <span class="es-photo-count-pill">${
        photos.length -
        (counts.before || 0) -
        (counts.after || 0) -
        (counts.progress || 0)
      } Other</span>
    </div>
  `;

  const groupHtml = Array.from(groups.entries())
    .map(([key, groupPhotos], groupIndex) => {
      const first = groupPhotos[0];
      const groupDate =
        first.taken_at ||
        first.appointment_start_at ||
        first.created_at;
      const groupLabel = [
        first.service_name || "Customer photos",
        formatShortDate(groupDate)
      ]
        .filter(Boolean)
        .join(" · ");

      const beforePhotos = groupPhotos.filter(
        (photo) => photo.photo_type === "before"
      );
      const afterPhotos = groupPhotos.filter(
        (photo) => photo.photo_type === "after"
      );

      return `
        <section class="es-customer-photo-group">
          <div class="es-customer-photo-group-header">
            <div>
              <strong>${escapeHtml(groupLabel)}</strong>
              <small>${groupPhotos.length} photo${groupPhotos.length === 1 ? "" : "s"}</small>
            </div>
            ${
              beforePhotos.length && afterPhotos.length
                ? `<button class="es-secondary-button es-photo-compare-button" type="button" data-photo-compare-group="${groupIndex}">Compare before & after</button>`
                : ""
            }
          </div>

          <div class="es-customer-photo-grid">
            ${groupPhotos
              .map(
                (photo) => `
                  <article class="es-customer-photo-card">
                    <a
                      class="es-customer-photo-image-button"
                      href="${escapeHtml(photo.content_url)}"
                      target="_blank"
                      rel="noopener"
                      aria-label="Open ${escapeHtml(formatPhotoType(photo.photo_type))} photo"
                    >
                      <img
                        src="${escapeHtml(photo.content_url)}"
                        alt="${escapeHtml(`${formatPhotoType(photo.photo_type)} photo`)}"
                        loading="lazy"
                      >
                    </a>

                    <div class="es-customer-photo-meta">
                      <strong>${escapeHtml(formatPhotoType(photo.photo_type))}</strong>
                      <span>${escapeHtml(formatShortDate(photo.taken_at || photo.created_at))}</span>
                      ${
                        photo.notes
                          ? `<span>${escapeHtml(photo.notes)}</span>`
                          : ""
                      }
                    </div>

                    <div class="es-customer-photo-actions">
                      <a
                        class="es-customer-action"
                        href="${escapeHtml(photo.content_url)}"
                        target="_blank"
                        rel="noopener"
                      >Open</a>

                      <button
                        class="es-customer-action"
                        type="button"
                        data-delete-customer-photo="${escapeHtml(photo.id)}"
                      >Delete</button>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");

  customerPhotos.innerHTML = summary + groupHtml;

  const groupedValues = Array.from(groups.values());

  customerPhotos
    .querySelectorAll("[data-photo-compare-group]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const group = groupedValues[Number(button.dataset.photoCompareGroup)] || [];
        const beforePhotos = group.filter(
          (photo) => photo.photo_type === "before"
        );
        const afterPhotos = group.filter(
          (photo) => photo.photo_type === "after"
        );
        const first = group[0];

        if (
          !beforePhotos.length ||
          !afterPhotos.length ||
          !first
        ) return;

        openCustomerPhotoCompare(
          beforePhotos,
          afterPhotos,
          [
            first.service_name || "Photo comparison",
            formatShortDate(
              first.taken_at ||
              first.appointment_start_at ||
              first.created_at
            )
          ].filter(Boolean).join(" · ")
        );
      });
    });

  customerPhotos
    .querySelectorAll("[data-delete-customer-photo]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        deleteCustomerPhoto(button.dataset.deleteCustomerPhoto)
      );
    });
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
                appointment.booking_kind ===
                  "consultation"
                  ? `Consultation · ${
                      appointment.service_name
                    }`
                  : appointment.service_name
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
          <option
            value="${escapeHtml(
              record.id
            )}"
            data-appointment-id="${escapeHtml(
              record.appointment_id ||
              ""
            )}"
            data-service-id="${escapeHtml(
              record.service_id ||
              ""
            )}"
          >
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


function customerPhotoItemId(index, field) {
  return `customerPhotoItem_${index}_${field}`;
}

function clearCustomerPhotoPreviewUrls() {
  customerPhotoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  customerPhotoPreviewUrls = [];
}

function setCustomerPhotoType(index, type) {
  const input = document.getElementById(customerPhotoItemId(index, "type"));
  if (!input) return;
  input.value = type;

  document
    .querySelectorAll(`[data-photo-type-index="${index}"]`)
    .forEach((button) => {
      button.classList.toggle(
        "is-selected",
        button.dataset.photoTypeValue === type
      );
      button.setAttribute(
        "aria-pressed",
        button.dataset.photoTypeValue === type ? "true" : "false"
      );
    });
}

function renderSelectedCustomerPhotos() {
  const input = document.getElementById("customerPhotoFile");
  const wrap = document.getElementById("customerPhotoItems");
  const files = Array.from(input?.files || []);

  clearCustomerPhotoPreviewUrls();

  if (!files.length) {
    wrap.innerHTML = "";
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  wrap.innerHTML = files.map((file, index) => {
    const previewUrl = URL.createObjectURL(file);
    customerPhotoPreviewUrls.push(previewUrl);

    return `
      <section class="es-customer-photo-upload-item" data-photo-index="${index}">
        <div class="es-customer-photo-upload-preview">
          <img src="${escapeHtml(previewUrl)}" alt="Preview of ${escapeHtml(file.name)}">
          <div>
            <strong>Photo ${index + 1}</strong>
            <small>${escapeHtml(file.name)}</small>
          </div>
        </div>

        <input id="${customerPhotoItemId(index, "type")}" type="hidden" value="before">

        <div class="es-customer-photo-field-label">Photo type</div>
        <div class="es-customer-photo-type-pills" role="group" aria-label="Photo type for photo ${index + 1}">
          ${["before", "after", "progress", "other"].map((type) => `
            <button
              class="es-photo-type-pill ${type === "before" ? "is-selected" : ""}"
              type="button"
              data-photo-type-index="${index}"
              data-photo-type-value="${type}"
              aria-pressed="${type === "before" ? "true" : "false"}"
            >${escapeHtml(formatPhotoType(type))}</button>
          `).join("")}
        </div>

        <label>
          Date
          <input id="${customerPhotoItemId(index, "date")}" type="date" value="${today}">
        </label>

        <label>
          Notes
          <textarea
            id="${customerPhotoItemId(index, "notes")}"
            maxlength="1000"
            placeholder="Optional notes for this photo"
          ></textarea>
        </label>
      </section>
    `;
  }).join("");

  wrap
    .querySelectorAll("[data-photo-type-index]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        setCustomerPhotoType(
          Number(button.dataset.photoTypeIndex),
          button.dataset.photoTypeValue
        );
      });
    });
}


function selectedCustomerPhotoMetadata(index) {
  return {
    photoType: document.getElementById(customerPhotoItemId(index, "type"))?.value || "other",
    takenAt: document.getElementById(customerPhotoItemId(index, "date"))?.value || "",
    notes: document.getElementById(customerPhotoItemId(index, "notes"))?.value || ""
  };
}


function chooseSmartCustomerPhotoLinks() {
  if (!activeProfileCustomer) return;

  const appointmentSelect = document.getElementById("customerPhotoAppointment");
  const treatmentSelect = document.getElementById("customerPhotoTreatmentRecord");
  if (!appointmentSelect || !treatmentSelect) return;

  const allAppointments = [
    ...(activeProfileCustomer.upcoming_bookings || []),
    ...(activeProfileCustomer.booking_history || [])
  ];

  const treatmentAppointments = allAppointments.filter(
    (appointment) => appointment.booking_kind !== "consultation"
  );

  const candidates = treatmentAppointments.length
    ? treatmentAppointments
    : allAppointments;

  const now = Date.now();
  const selectedAppointment = candidates
    .filter((appointment) => appointment.start_at)
    .sort((a, b) => {
      const aTime = new Date(a.start_at).getTime();
      const bTime = new Date(b.start_at).getTime();
      return Math.abs(aTime - now) - Math.abs(bTime - now);
    })[0];

  if (selectedAppointment?.id) {
    appointmentSelect.value = String(selectedAppointment.id);
  }

  const matchingTreatment = (activeProfileCustomer.treatment_records || [])
    .find((record) =>
      selectedAppointment?.id &&
      String(record.appointment_id || "") === String(selectedAppointment.id)
    );

  if (matchingTreatment?.id) {
    treatmentSelect.value = String(matchingTreatment.id);
  }
}

function openCustomerPhotoDialog() {
  if (!activeProfileCustomer) {
    return;
  }

  customerPhotoForm.reset();
  clearCustomerPhotoPreviewUrls();

  document.getElementById(
    "customerPhotoItems"
  ).innerHTML = "";

  customerPhotoStatus.hidden = true;

  document
    .getElementById(
      "customerPhotoDialogTitle"
    )
    .textContent =
      `Add photo · ${
        activeProfileCustomer.first_name
      }`;

  chooseSmartCustomerPhotoLinks();

  if (
    typeof customerPhotoDialog.showModal ===
    "function"
  ) {
    customerPhotoDialog.showModal();
  }
}


function closeCustomerPhotoDialog() {
  clearCustomerPhotoPreviewUrls();

  if (
    customerPhotoDialog
      ?.open
  ) {
    customerPhotoDialog.close();
  }
}


async function optimiseCustomerPhoto(
  file
) {
  const tenMb =
    10 * 1024 * 1024;

  if (
    file.size <= tenMb
  ) {
    return file;
  }

  if (
    file.size >
    30 * 1024 * 1024
  ) {
    throw new Error(
      "This image is over 30 MB. Please choose a smaller original photo."
    );
  }

  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp"
    ].includes(
      file.type
    )
  ) {
    throw new Error(
      "Photo must be JPG, PNG or WebP."
    );
  }

  customerPhotoStatus.hidden =
    false;

  customerPhotoStatus.className =
    "es-status";

  customerPhotoStatus.textContent =
    "Optimising large photo for secure upload…";

  let bitmap;

  try {
    bitmap =
      await createImageBitmap(
        file
      );
  } catch {
    throw new Error(
      "This image could not be opened. Please choose another JPG, PNG or WebP photo."
    );
  }

  const maxDimension = 3200;

  const scale =
    Math.min(
      1,
      maxDimension /
      Math.max(
        bitmap.width,
        bitmap.height
      )
    );

  const width =
    Math.max(
      1,
      Math.round(
        bitmap.width *
        scale
      )
    );

  const height =
    Math.max(
      1,
      Math.round(
        bitmap.height *
        scale
      )
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    bitmap.close?.();

    throw new Error(
      "This browser could not optimise the image."
    );
  }

  context.drawImage(
    bitmap,
    0,
    0,
    width,
    height
  );

  bitmap.close?.();

  const outputType =
    file.type ===
      "image/png"
      ? "image/png"
      : file.type ===
          "image/webp"
        ? "image/webp"
        : "image/jpeg";

  const quality =
    outputType ===
      "image/png"
      ? undefined
      : 0.9;

  const blob =
    await new Promise(
      (resolve) => {
        canvas.toBlob(
          resolve,
          outputType,
          quality
        );
      }
    );

  if (!blob) {
    throw new Error(
      "The photo could not be optimised."
    );
  }

  const optimised =
    new File(
      [blob],
      file.name,
      {
        type:
          outputType,
        lastModified:
          file.lastModified
      }
    );

  if (
    optimised.size >
    tenMb
  ) {
    throw new Error(
      "The photo is still over 10 MB after optimisation. Please choose a smaller image."
    );
  }

  return optimised;
}


function validateCustomerPhotoLinks() {
  const appointmentSelect =
    document.getElementById(
      "customerPhotoAppointment"
    );

  const treatmentSelect =
    document.getElementById(
      "customerPhotoTreatmentRecord"
    );

  const treatmentOption =
    treatmentSelect
      ?.selectedOptions?.[0];

  const treatmentAppointmentId =
    treatmentOption
      ?.dataset
      ?.appointmentId ||
    "";

  if (
    treatmentAppointmentId &&
    !appointmentSelect.value
  ) {
    appointmentSelect.value =
      treatmentAppointmentId;
  }

  if (
    treatmentAppointmentId &&
    appointmentSelect.value &&
    appointmentSelect.value !==
      treatmentAppointmentId
  ) {
    treatmentSelect.value = "";

    showCustomerPhotoStatus(
      "The treatment record was cleared because it belongs to a different appointment.",
      "error"
    );
  }
}


async function uploadCustomerPhoto(event) {
  event.preventDefault();

  if (!activeProfileCustomer) return;

  const button = document.getElementById("saveCustomerPhotoButton");
  const files = Array.from(
    document.getElementById("customerPhotoFile").files || []
  );

  if (!files.length) {
    showCustomerPhotoStatus("Choose at least one photo first.", "error");
    return;
  }

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const invalid = files.find((file) => !allowed.includes(file.type));

  if (invalid) {
    showCustomerPhotoStatus(
      `${invalid.name}: photo must be JPG, PNG or WebP.`,
      "error"
    );
    return;
  }

  button.disabled = true;

  try {
    validateCustomerPhotoLinks();

    const appointmentId =
      document.getElementById("customerPhotoAppointment").value;
    const treatmentRecordId =
      document.getElementById("customerPhotoTreatmentRecord").value;

    for (let index = 0; index < files.length; index += 1) {
      button.textContent =
        files.length === 1
          ? "Uploading…"
          : `Uploading ${index + 1} of ${files.length}…`;

      const metadata = selectedCustomerPhotoMetadata(index);
      const file = await optimiseCustomerPhoto(files[index]);
      const formData = new FormData();

      formData.append("customer_id", activeProfileCustomer.id);
      formData.append("photo", file);
      formData.append("photo_type", metadata.photoType);
      formData.append("taken_at", metadata.takenAt);
      formData.append("appointment_id", appointmentId);
      formData.append("treatment_record_id", treatmentRecordId);
      formData.append("notes", metadata.notes);

      const response = await fetch("/api/customer-photos", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          `Photo ${index + 1} (${files[index].name}): ${
            data.error || "Unable to upload photo."
          }`
        );
      }
    }

    closeCustomerPhotoDialog();
    await loadCustomerProfile(activeProfileCustomer.id);
  } catch (error) {
    showCustomerPhotoStatus(
      error.message || "Unable to upload photos.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Upload photos";
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


function setCustomerProfileSummary(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}


function updateCustomerProfileSummaries(
  customer
) {
  const upcoming =
    customer.upcoming_bookings || [];

  const history =
    customer.booking_history || [];

  const packages =
    customer.packages || [];

  const activePackages =
    packages.filter(
      item => item.status === "active"
    ).length;

  const formRequests =
    customer.form_requests || [];

  const outstandingForms =
    visibleOutstandingFormRequests(
      formRequests
    ).length;

  const completedForms =
    formRequests.filter(
      request =>
        ["submitted", "reviewed"].includes(
          request.status
        )
    ).length;

  const photos =
    customer.photos || [];

  const treatmentRecords =
    customer.treatment_records || [];

  const communications =
    customer.communications || [];

  const timeline =
    customer.timeline || [];

  const summary =
    customer.financial_summary || {};

  setCustomerProfileSummary(
    "customerContactSummary",
    [
      customer.email ? "Email" : null,
      customer.phone ? "Phone" : null,
      customer.notes ? "Notes" : null
    ].filter(Boolean).join(" · ") || "Contact details"
  );

  setCustomerProfileSummary(
    "customerAppointmentsSummary",
    `${upcoming.length} upcoming · ${activePackages} active package${activePackages === 1 ? "" : "s"} · ${history.length} previous`
  );

  setCustomerProfileSummary(
    "customerRecordsSummary",
    `${completedForms} complete · ${outstandingForms} outstanding · ${photos.length} photo${photos.length === 1 ? "" : "s"}`
  );

  setCustomerProfileSummary(
    "customerPaymentsSummary",
    `${formatMoney(customer.total_paid_minor || 0)} paid · ${formatMoney(summary.total_outstanding_minor || 0)} outstanding`
  );

  setCustomerProfileSummary(
    "customerCommunicationsSummary",
    `${communications.length} communication${communications.length === 1 ? "" : "s"}`
  );

  setCustomerProfileSummary(
    "customerTimelineSummary",
    `${timeline.length} activit${timeline.length === 1 ? "y" : "ies"}`
  );

  const health =
    document.getElementById(
      "customerRecordHealth"
    );

  if (health) {
    const formStatus =
      outstandingForms > 0
        ? `<span class="es-customer-traffic es-customer-traffic-red">${outstandingForms} form${outstandingForms === 1 ? "" : "s"} outstanding</span>`
        : completedForms > 0
          ? `<span class="es-customer-traffic es-customer-traffic-green">Forms complete</span>`
          : `<span class="es-customer-traffic es-customer-traffic-neutral">No forms yet</span>`;

    health.innerHTML =
      formStatus +
      `<span class="es-customer-traffic ${treatmentRecords.length ? "es-customer-traffic-green" : "es-customer-traffic-neutral"}">${treatmentRecords.length} treatment record${treatmentRecords.length === 1 ? "" : "s"}</span>` +
      `<span class="es-customer-traffic ${photos.length ? "es-customer-traffic-green" : "es-customer-traffic-neutral"}">${photos.length} photo${photos.length === 1 ? "" : "s"}</span>`;
  }
}


function renderCustomerProfile(
  customer
) {

  activeProfileCustomer =
    customer;

  updateCustomerProfileSummaries(
    customer
  );

  showFailedCustomerPayments =
    false;

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

    ${profileStat(
      "Outstanding",
      formatMoney(
        customer
          .financial_summary
          ?.total_outstanding_minor ||
        0
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


  renderCustomerPackages(
    customer.packages ||
    []
  );


  renderCustomerPayments(
    customer.payments ||
    [],
    customer.financial_summary ||
    {}
  );


  renderCustomerCommunications(
    customer.communications ||
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

  /* Mobile profile opens in a clean collapsed state.
     Desktop keeps the existing default open/closed behaviour. */
  if (
    window.matchMedia(
      "(max-width: 700px)"
    ).matches
  ) {
    customerDrawer
      .querySelectorAll(
        ".es-customer-accordion"
      )
      .forEach(
        (section) => {
          section.open =
            false;
        }
      );
  }
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
                appointment.booking_kind ===
                  "consultation"
                  ? `Consultation · ${
                      appointment.service_name
                    }`
                  : appointment.service_name
              )}
            </strong>

            <small>
              ${
                appointment.customer_package_id
                  ? `${escapeHtml(
                      appointment.package_name ||
                      "Package"
                    )} · Covered by package`
                  : formatMoney(
                      appointment.price_minor
                    )
              }
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

          <a
            class="es-customer-action es-customer-appointment-action"
            href="/bookings/?booking=${encodeURIComponent(
              appointment.id
            )}"
          >
            View
          </a>

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

window.addEventListener("message", event => {
  if (event.origin !== location.origin) return;
  if (event.data?.type !== "eselram:clinical-record-saved") return;

  if (activeProfileCustomer?.id) {
    loadCustomerProfile(activeProfileCustomer.id);
  }
});


const initialCustomerId =
  new URLSearchParams(
    location.search
  )
    .get("customer");


loadCustomers()
  .then(
    () => {
      if (initialCustomerId) {
        return loadCustomerProfile(
          initialCustomerId
        );
      }

      return null;
    }
  );


loadCustomerClinicalOverview();

