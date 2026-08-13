const treatmentFormPanel =
  document.getElementById(
    "treatmentFormPanel"
  );

const treatmentForm =
  document.getElementById(
    "treatmentForm"
  );

const treatmentRecordId =
  document.getElementById(
    "treatmentRecordId"
  );

const treatmentCustomer =
  document.getElementById(
    "treatmentCustomer"
  );

const treatmentAppointment =
  document.getElementById(
    "treatmentAppointment"
  );

const treatmentService =
  document.getElementById(
    "treatmentService"
  );

const treatmentDate =
  document.getElementById(
    "treatmentDate"
  );

const practitionerName =
  document.getElementById(
    "practitionerName"
  );

const treatmentFormStatus =
  document.getElementById(
    "treatmentFormStatus"
  );

const saveTreatmentButton =
  document.getElementById(
    "saveTreatmentButton"
  );

const treatmentRecordsList =
  document.getElementById(
    "treatmentRecordsList"
  );

const treatmentSearch =
  document.getElementById(
    "treatmentSearch"
  );

const treatmentStatusFilter =
  document.getElementById(
    "treatmentStatusFilter"
  );

const treatmentDrawer =
  document.getElementById(
    "treatmentDrawer"
  );

const treatmentDrawerBackdrop =
  document.getElementById(
    "treatmentDrawerBackdrop"
  );

const treatmentDrawerTitle =
  document.getElementById(
    "treatmentDrawerTitle"
  );

const treatmentDetails =
  document.getElementById(
    "treatmentDetails"
  );

const treatmentClinicalNotes =
  document.getElementById(
    "treatmentClinicalNotes"
  );

const openTreatmentCustomerButton =
  document.getElementById(
    "openTreatmentCustomerButton"
  );


const createNextTreatmentButton =
  document.getElementById(
    "createNextTreatmentButton"
  );


let records = [];
let customers = [];
let appointments = [];
let services = [];
let currentUser = null;
let activeRecord = null;


document
  .getElementById(
    "newTreatmentButton"
  )
  .addEventListener(
    "click",
    () =>
      openTreatmentForm()
  );


document
  .getElementById(
    "closeTreatmentFormButton"
  )
  .addEventListener(
    "click",
    closeTreatmentForm
  );


document
  .getElementById(
    "closeTreatmentDrawer"
  )
  .addEventListener(
    "click",
    closeTreatmentDrawer
  );


treatmentDrawerBackdrop
  .addEventListener(
    "click",
    closeTreatmentDrawer
  );


document
  .getElementById(
    "editTreatmentButton"
  )
  .addEventListener(
    "click",
    () => {

      if (!activeRecord) {
        return;
      }

      closeTreatmentDrawer();

      openTreatmentForm(
        activeRecord
      );
    }
  );


createNextTreatmentButton.addEventListener(
  "click",
  () => {
    if (!activeRecord) return;
    const source = activeRecord;
    closeTreatmentDrawer();
    openTreatmentForm();
    applySafePreviousRecordDefaults(source);
  }
);


treatmentSearch.addEventListener(
  "input",
  renderRecords
);


treatmentStatusFilter.addEventListener(
  "change",
  renderRecords
);


treatmentCustomer.addEventListener(
  "change",
  renderAppointmentOptions
);


treatmentAppointment.addEventListener(
  "change",
  applyAppointmentDefaults
);


/* =======================================================
   Load
   ======================================================= */

async function loadTreatmentRecords() {

  try {

    const response =
      await fetch(
        "/api/treatment-records",
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
        "Unable to load treatment records."
      );
    }


    records =
      data.records ||
      [];

    customers =
      data.customers ||
      [];

    appointments =
      data.appointments ||
      [];

    services =
      data.services ||
      [];

    currentUser =
      data.user ||
      null;


    renderStats(
      data.stats ||
      {}
    );

    renderCustomerOptions();

    renderServiceOptions();

    renderRecords();


  } catch (error) {

    treatmentRecordsList.className =
      "es-status error";

    treatmentRecordsList.textContent =
      error.message ||
      "Unable to load treatment records.";
  }
}


function renderStats(
  stats
) {

  document
    .getElementById(
      "totalRecords"
    )
    .textContent =
      stats.total_records ||
      0;


  document
    .getElementById(
      "monthRecords"
    )
    .textContent =
      stats.month_records ||
      0;


  document
    .getElementById(
      "draftRecords"
    )
    .textContent =
      stats.draft_records ||
      0;


  document
    .getElementById(
      "followupRecords"
    )
    .textContent =
      stats.followup_records ||
      0;
}


/* =======================================================
   Form
   ======================================================= */

function openTreatmentForm(
  record = null
) {

  treatmentForm.reset();

  treatmentRecordId.value =
    "";

  treatmentFormStatus.hidden =
    true;

  saveTreatmentButton.disabled =
    false;

  renderCustomerOptions();

  renderServiceOptions();


  if (record) {

    treatmentRecordId.value =
      record.id;


    document
      .getElementById(
        "treatmentFormTitle"
      )
      .textContent =
        "Edit treatment record";


    saveTreatmentButton.textContent =
      "Save changes";


    treatmentCustomer.value =
      record.customer_id;


    renderAppointmentOptions();


    treatmentAppointment.value =
      record.appointment_id ||
      "";


    treatmentService.value =
      record.service_id ||
      "";


    treatmentDate.value =
      dateInputValue(
        record.treatment_date
      );


    practitionerName.value =
      record.practitioner_name ||
      currentUser?.name ||
      "";


    document
      .getElementById(
        "treatmentStatus"
      )
      .value =
        record.status ||
        "complete";


    document
      .getElementById(
        "treatmentArea"
      )
      .value =
        record.treatment_area ||
        "";


    document
      .getElementById(
        "deviceName"
      )
      .value =
        record.device_name ||
        "";


    document
      .getElementById(
        "deviceSettings"
      )
      .value =
        record.device_settings ||
        "";


    document
      .getElementById(
        "treatmentNotes"
      )
      .value =
        record.treatment_notes ||
        "";


    document
      .getElementById(
        "clientResponse"
      )
      .value =
        record.client_response ||
        "";


    document
      .getElementById(
        "clientTolerance"
      )
      .value =
        record.client_tolerance ||
        "";


    document
      .getElementById(
        "aftercareNotes"
      )
      .value =
        record.aftercare_notes ||
        "";


    document
      .getElementById(
        "nextSessionPlan"
      )
      .value =
        record.next_session_plan ||
        "";


    document
      .getElementById(
        "nextTreatmentDate"
      )
      .value =
        record.next_treatment_date
          ? dateInputValue(
              record.next_treatment_date
            )
          : "";


  } else {

    document
      .getElementById(
        "treatmentFormTitle"
      )
      .textContent =
        "New treatment record";


    saveTreatmentButton.textContent =
      "Save record";


    treatmentDate.value =
      dateInputValue(
        new Date()
      );


    practitionerName.value =
      currentUser?.name ||
      "";


    renderAppointmentOptions();
  }


  treatmentFormPanel.hidden =
    false;


  treatmentFormPanel.scrollIntoView({
    behavior:
      "smooth",
    block:
      "start"
  });
}


function applySafePreviousRecordDefaults(source) {
  if (!source) return;

  treatmentCustomer.value = source.customer_id || "";
  renderAppointmentOptions();

  treatmentService.value = source.service_id || "";
  practitionerName.value = source.practitioner_name || currentUser?.name || "";
  document.getElementById("treatmentArea").value = source.treatment_area || "";
  document.getElementById("deviceName").value = source.device_name || "";

  // Clinical observations and treatment settings deliberately stay blank.
  document.getElementById("deviceSettings").value = "";
  document.getElementById("treatmentNotes").value = "";
  document.getElementById("clientResponse").value = "";
  document.getElementById("clientTolerance").value = "";
  document.getElementById("aftercareNotes").value = "";
  document.getElementById("nextSessionPlan").value = "";
  document.getElementById("nextTreatmentDate").value = "";
  document.getElementById("treatmentStatus").value = "complete";

  chooseSmartTreatmentAppointment(source.customer_id, source.service_id);
}

function chooseSmartTreatmentAppointment(customerId, serviceId = "") {
  const candidates = appointments
    .filter((appointment) =>
      String(appointment.customer_id) === String(customerId) &&
      appointment.booking_kind !== 'consultation' &&
      (!serviceId || String(appointment.service_id) === String(serviceId))
    )
    .sort((a, b) => {
      const now = Date.now();
      return Math.abs(new Date(a.start_at).getTime() - now) -
        Math.abs(new Date(b.start_at).getTime() - now);
    });

  const unrecorded = candidates.find((appointment) =>
    !records.some((record) => String(record.appointment_id || "") === String(appointment.id))
  );
  const selected = unrecorded || candidates[0];

  if (selected) {
    treatmentAppointment.value = selected.id;
    applyAppointmentDefaults();
  }
}

function closeTreatmentForm() {

  treatmentFormPanel.hidden =
    true;

  treatmentForm.reset();

  treatmentRecordId.value =
    "";

  treatmentFormStatus.hidden =
    true;
}


function renderCustomerOptions() {

  const currentValue =
    treatmentCustomer.value;


  treatmentCustomer.innerHTML = `
    <option value="">
      Select customer
    </option>

    ${
      customers
        .map(
          (customer) => `
            <option
              value="${escapeHtml(
                customer.id
              )}"
            >
              ${escapeHtml(
                `${customer.first_name} ${customer.last_name}`
              )}
            </option>
          `
        )
        .join("")
    }
  `;


  if (currentValue) {
    treatmentCustomer.value =
      currentValue;
  }
}


function renderServiceOptions() {

  const currentValue =
    treatmentService.value;


  treatmentService.innerHTML = `
    <option value="">
      Select service
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
            </option>
          `
        )
        .join("")
    }
  `;


  if (currentValue) {
    treatmentService.value =
      currentValue;
  }
}


function renderAppointmentOptions() {

  const customerId =
    treatmentCustomer.value;


  const filtered =
    appointments.filter(
      (appointment) =>
        appointment.booking_kind !== 'consultation' &&
        (
          !customerId ||
          appointment.customer_id ===
            customerId
        )
    );


  const currentValue =
    treatmentAppointment.value;


  treatmentAppointment.innerHTML = `
    <option value="">
      No linked appointment
    </option>

    ${
      filtered
        .map(
          (appointment) => `
            <option
              value="${escapeHtml(
                appointment.id
              )}"
            >
              ${escapeHtml(
                `${formatShortDate(
                  appointment.start_at
                )} · ${appointment.service_name}`
              )}
            </option>
          `
        )
        .join("")
    }
  `;


  if (
    currentValue &&
    filtered.some(
      (appointment) =>
        appointment.id ===
        currentValue
    )
  ) {

    treatmentAppointment.value =
      currentValue;
  }
}


function applyAppointmentDefaults() {

  const appointment =
    appointments.find(
      (item) =>
        item.id ===
        treatmentAppointment.value
    );


  if (!appointment) {
    return;
  }


  treatmentCustomer.value =
    appointment.customer_id;

  treatmentService.value =
    appointment.service_id;

  treatmentDate.value =
    dateInputValue(
      appointment.start_at
    );
}


treatmentForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const editing =
      Boolean(
        treatmentRecordId.value
      );


    const payload = {
      id:
        treatmentRecordId.value ||
        undefined,

      customer_id:
        treatmentCustomer.value,

      appointment_id:
        treatmentAppointment.value ||
        null,

      service_id:
        treatmentService.value,

      treatment_date:
        treatmentDate.value,

      practitioner_name:
        practitionerName.value.trim(),

      status:
        document
          .getElementById(
            "treatmentStatus"
          )
          .value,

      treatment_area:
        document
          .getElementById(
            "treatmentArea"
          )
          .value
          .trim(),

      device_name:
        document
          .getElementById(
            "deviceName"
          )
          .value
          .trim(),

      device_settings:
        document
          .getElementById(
            "deviceSettings"
          )
          .value
          .trim(),

      treatment_notes:
        document
          .getElementById(
            "treatmentNotes"
          )
          .value
          .trim(),

      client_response:
        document
          .getElementById(
            "clientResponse"
          )
          .value
          .trim(),

      client_tolerance:
        document
          .getElementById(
            "clientTolerance"
          )
          .value
          .trim(),

      aftercare_notes:
        document
          .getElementById(
            "aftercareNotes"
          )
          .value
          .trim(),

      next_session_plan:
        document
          .getElementById(
            "nextSessionPlan"
          )
          .value
          .trim(),

      next_treatment_date:
        document
          .getElementById(
            "nextTreatmentDate"
          )
          .value ||
        null
    };


    if (
      !payload.customer_id ||
      !payload.service_id ||
      !payload.treatment_date ||
      !payload.practitioner_name
    ) {

      showFormError(
        "Customer, service, treatment date and practitioner are required."
      );

      return;
    }


    treatmentFormStatus.hidden =
      false;

    treatmentFormStatus.className =
      "es-status";

    treatmentFormStatus.textContent =
      editing
        ? "Saving changes…"
        : "Saving treatment record…";

    saveTreatmentButton.disabled =
      true;


    try {

      const response =
        await fetch(
          "/api/treatment-records",
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
          "Unable to save treatment record."
        );
      }


      treatmentFormStatus.className =
        "es-status success";

      treatmentFormStatus.textContent =
        editing
          ? "Treatment record updated."
          : "Treatment record saved.";


      await loadTreatmentRecords();

      const savedCustomerId = String(
        treatmentCustomer.value || ""
      ).trim();

      if (savedCustomerId) {
        setTimeout(
          () => {
            window.location.href =
              `/customers/?customer=${encodeURIComponent(savedCustomerId)}`;
          },
          500
        );
      } else {
        setTimeout(
          closeTreatmentForm,
          500
        );
      }


    } catch (error) {

      showFormError(
        error.message ||
        "Unable to save treatment record."
      );


    } finally {

      saveTreatmentButton.disabled =
        false;
    }
  }
);


function showFormError(
  message
) {

  treatmentFormStatus.hidden =
    false;

  treatmentFormStatus.className =
    "es-status error";

  treatmentFormStatus.textContent =
    message;
}


/* =======================================================
   List
   ======================================================= */

function renderRecords() {

  const query =
    treatmentSearch
      .value
      .trim()
      .toLowerCase();


  const status =
    treatmentStatusFilter.value;


  const filtered =
    records.filter(
      (record) => {

        if (
          status !== "all" &&
          record.status !== status
        ) {

          return false;
        }


        if (!query) {
          return true;
        }


        const searchable = [
          record.first_name,
          record.last_name,
          record.service_name,
          record.treatment_area,
          record.practitioner_name
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

    treatmentRecordsList.className =
      "es-empty-state";

    treatmentRecordsList.innerHTML = `
      <strong>
        No treatment records found.
      </strong>

      <span>
        Create a treatment record from a completed or existing appointment.
      </span>
    `;

    return;
  }


  treatmentRecordsList.className =
    "es-treatment-list";


  treatmentRecordsList.innerHTML =
    filtered
      .map(
        (record) => `
          <article class="es-treatment-row">

            <div class="es-treatment-cell">

              <strong>
                ${formatShortDate(
                  record.treatment_date
                )}
              </strong>

              <span>
                ${escapeHtml(
                  record.practitioner_name ||
                  "Practitioner"
                )}
              </span>

            </div>


            <div class="es-treatment-cell">

              <strong>
                ${escapeHtml(
                  `${record.first_name} ${record.last_name}`
                )}
              </strong>

              <span>
                ${escapeHtml(
                  record.treatment_area ||
                  "No treatment area"
                )}
              </span>

            </div>


            <div class="es-treatment-cell">

              <strong>
                ${escapeHtml(
                  record.service_name ||
                  "Service"
                )}
              </strong>

              <span>
                ${escapeHtml(
                  record.device_name ||
                  "No device recorded"
                )}
              </span>

            </div>


            <div>

              <span
                class="
                  es-treatment-status
                  es-treatment-status-${escapeHtml(
                    record.status
                  )}
                "
              >
                ${escapeHtml(
                  formatStatus(
                    record.status
                  )
                )}
              </span>

            </div>


            <div class="es-treatment-actions">

              <button
                class="es-treatment-action"
                type="button"
                data-view-treatment="${escapeHtml(
                  record.id
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
      "[data-view-treatment]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const record =
              records.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .viewTreatment
              );


            if (record) {

              showTreatmentDetails(
                record
              );
            }
          }
        );
      }
    );
}


/* =======================================================
   Drawer
   ======================================================= */

function showTreatmentDetails(
  record
) {

  activeRecord =
    record;


  treatmentDrawerTitle.textContent =
    `${record.first_name} ${record.last_name}`;


  treatmentDetails.innerHTML = `
    ${detailItem(
      "Service",
      record.service_name ||
      "—"
    )}

    ${detailItem(
      "Status",
      formatStatus(
        record.status
      )
    )}

    ${detailItem(
      "Treatment date",
      formatFullDate(
        record.treatment_date
      )
    )}

    ${detailItem(
      "Practitioner",
      record.practitioner_name ||
      "—"
    )}

    ${detailItem(
      "Treatment area",
      record.treatment_area ||
      "—"
    )}

    ${detailItem(
      "Device / machine",
      record.device_name ||
      "—"
    )}

    ${detailItem(
      "Device settings",
      record.device_settings ||
      "—",
      true
    )}

    ${detailItem(
      "Next treatment date",
      record.next_treatment_date
        ? formatFullDate(
            record.next_treatment_date
          )
        : "—"
    )}
  `;


  treatmentClinicalNotes.innerHTML = `
    ${noteSection(
      "Treatment notes",
      record.treatment_notes
    )}

    ${noteSection(
      "Client response",
      record.client_response
    )}

    ${noteSection(
      "Client tolerance",
      record.client_tolerance
    )}

    ${noteSection(
      "Aftercare",
      record.aftercare_notes
    )}

    ${noteSection(
      "Next-session plan",
      record.next_session_plan
    )}
  `;


  openTreatmentCustomerButton.href =
    `/customers/?customer=${encodeURIComponent(
      record.customer_id
    )}`;


  openTreatmentDrawer();
}


function detailItem(
  label,
  value,
  full = false
) {

  return `
    <div
      class="
        es-treatment-detail
        ${
          full
            ? "es-treatment-detail-full"
            : ""
        }
      "
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


function noteSection(
  title,
  value
) {

  if (!value) {
    return "";
  }


  return `
    <section class="es-treatment-section">

      <h3>
        ${escapeHtml(title)}
      </h3>

      <div class="es-treatment-note-box">
        ${escapeHtml(value)}
      </div>

    </section>
  `;
}


function openTreatmentDrawer() {

  treatmentDrawer
    .classList
    .add(
      "is-open"
    );


  treatmentDrawerBackdrop
    .classList
    .add(
      "is-open"
    );


  treatmentDrawer
    .setAttribute(
      "aria-hidden",
      "false"
    );
}


function closeTreatmentDrawer() {

  activeRecord =
    null;


  treatmentDrawer
    .classList
    .remove(
      "is-open"
    );


  treatmentDrawerBackdrop
    .classList
    .remove(
      "is-open"
    );


  treatmentDrawer
    .setAttribute(
      "aria-hidden",
      "true"
    );
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


function dateInputValue(
  value
) {

  const date =
    value instanceof Date
      ? value
      : new Date(value);


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


function formatShortDate(
  value
) {

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


function formatFullDate(
  value
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday:
        "short",
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


function formatStatus(
  value
) {

  const values = {
    complete:
      "Complete",
    draft:
      "Draft"
  };


  return values[value] ||
    value ||
    "—";
}


function escapeHtml(
  value
) {

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


loadTreatmentRecords().then(() => {
  const params =
    new URLSearchParams(
      location.search
    );

  const recordId =
    params.get(
      "record"
    );

  const customerId =
    params.get(
      "customer"
    );

  const copyId =
    params.get(
      "copy"
    );

  if (recordId) {
    const record = records.find((item) => item.id === recordId);
    if (record) showTreatmentDetails(record);
  } else if (copyId) {
    const source = records.find((item) => item.id === copyId);
    openTreatmentForm();
    if (source) applySafePreviousRecordDefaults(source);
  } else if (customerId) {
    openTreatmentForm();
    treatmentCustomer.value = customerId;
    renderAppointmentOptions();
    chooseSmartTreatmentAppointment(customerId);
  }
});
