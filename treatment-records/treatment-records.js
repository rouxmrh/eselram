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

const treatmentServiceFilter =
  document.getElementById(
    "treatmentServiceFilter"
  );

const treatmentDateFilter =
  document.getElementById(
    "treatmentDateFilter"
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


const deleteTreatmentButton =
  document.getElementById(
    "deleteTreatmentButton"
  );


let records = [];
let customers = [];
let appointments = [];
let services = [];
let photos = [];
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


deleteTreatmentButton.addEventListener(
  "click",
  async () => {
    if (!activeRecord) {
      return;
    }

    const recordId =
      activeRecord.id;

    const confirmed =
      window.confirm(
        "Delete this treatment record? This cannot be undone. The appointment and customer will not be deleted."
      );

    if (!confirmed) {
      return;
    }

    deleteTreatmentButton.disabled =
      true;

    const originalText =
      deleteTreatmentButton.textContent;

    deleteTreatmentButton.textContent =
      "Deleting…";

    try {
      const response =
        await fetch(
          `/api/treatment-records?id=${encodeURIComponent(recordId)}`,
          {
            method:
              "DELETE",

            headers: {
              Accept:
                "application/json"
            }
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
          "Unable to delete treatment record."
        );
      }

      closeTreatmentDrawer();

      await loadTreatmentRecords();
    } catch (error) {
      window.alert(
        error.message ||
        "Unable to delete treatment record."
      );
    } finally {
      deleteTreatmentButton.disabled =
        false;

      deleteTreatmentButton.textContent =
        originalText;
    }
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

treatmentServiceFilter.addEventListener(
  "change",
  renderRecords
);

treatmentDateFilter.addEventListener(
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

    photos =
      data.photos ||
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

    renderServiceFilterOptions();

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


function renderServiceFilterOptions() {
  if (!treatmentServiceFilter) return;

  const currentValue = treatmentServiceFilter.value || "all";

  treatmentServiceFilter.innerHTML = `
    <option value="all">All services</option>
    ${services.map((service) => `
      <option value="${escapeHtml(service.id)}">${escapeHtml(service.name)}</option>
    `).join("")}
  `;

  if ([...treatmentServiceFilter.options].some((option) => option.value === currentValue)) {
    treatmentServiceFilter.value = currentValue;
  }
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


function chooseSmartTreatmentAppointment(customerId, serviceId = "") {
  const now = Date.now();

  const candidates = appointments
    .filter((appointment) =>
      String(appointment.customer_id) === String(customerId) &&
      appointment.booking_kind !== "consultation" &&
      (!serviceId || String(appointment.service_id) === String(serviceId))
    );

  const hasTreatmentRecord = (appointment) =>
    records.some(
      (record) =>
        String(record.appointment_id || "") === String(appointment.id)
    );

  // Prefer the customer's next unrecorded treatment appointment for this
  // service. If none is upcoming, fall back to the nearest unrecorded past
  // appointment, then to the nearest matching appointment of any kind.
  const unrecorded = candidates.filter((appointment) => !hasTreatmentRecord(appointment));

  const upcomingUnrecorded = unrecorded
    .filter((appointment) => new Date(appointment.start_at).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

  const pastUnrecorded = unrecorded
    .filter((appointment) => new Date(appointment.start_at).getTime() < now)
    .sort(
      (a, b) =>
        new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
    );

  const nearestMatching = [...candidates].sort(
    (a, b) =>
      Math.abs(new Date(a.start_at).getTime() - now) -
      Math.abs(new Date(b.start_at).getTime() - now)
  );

  const selected =
    upcomingUnrecorded[0] ||
    pastUnrecorded[0] ||
    nearestMatching[0];

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

  const serviceId =
    treatmentServiceFilter?.value || "all";

  const dateFilter =
    treatmentDateFilter?.value || "all";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const filtered =
    records.filter(
      (record) => {

        if (
          status !== "all" &&
          record.status !== status
        ) {
          return false;
        }

        if (
          serviceId !== "all" &&
          String(record.service_id || "") !== String(serviceId)
        ) {
          return false;
        }

        const recordDate = new Date(record.treatment_date);

        if (
          dateFilter === "this_month" &&
          recordDate < startOfMonth
        ) {
          return false;
        }

        if (
          dateFilter === "last_30" &&
          recordDate < thirtyDaysAgo
        ) {
          return false;
        }

        if (
          dateFilter === "last_90" &&
          recordDate < ninetyDaysAgo
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
          record.practitioner_name,
          record.device_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      }
    );

  if (filtered.length === 0) {
    treatmentRecordsList.className =
      "es-empty-state";

    treatmentRecordsList.innerHTML = `
      <strong>No treatment records found.</strong>
      <span>Try changing the filters or create a new treatment record.</span>
    `;

    return;
  }

  treatmentRecordsList.className =
    "es-treatment-list es-treatment-card-list";

  treatmentRecordsList.innerHTML =
    filtered
      .map(
        (record) => {
          const photoCount = Number(record.photo_count || 0);
          const complete = record.status === "complete";
          const statusLabel = complete ? "Complete" : "Needs details";

          return `
            <article class="es-treatment-record-card">
              <div class="es-treatment-record-main">
                <div class="es-treatment-record-heading">
                  <div>
                    <span class="es-treatment-record-date">${formatShortDate(record.treatment_date)}</span>
                    <h3>${escapeHtml(`${record.first_name} ${record.last_name}`)}</h3>
                    <p>${escapeHtml(record.service_name || "Service")}${record.treatment_area ? ` · ${escapeHtml(record.treatment_area)}` : ""}</p>
                  </div>

                </div>

                <div class="es-treatment-record-meta">
                  <span><strong>Practitioner</strong>${escapeHtml(record.practitioner_name || "—")}</span>
                  <span><strong>Device</strong>${escapeHtml(record.device_name || "Not recorded")}</span>
                  <span><strong>Photos</strong>${photoCount}</span>
                  <span><strong>Next treatment</strong>${record.next_treatment_date ? formatShortDate(record.next_treatment_date) : "—"}</span>
                </div>
              </div>

              <div class="es-treatment-record-controls">
                <span class="es-treatment-status es-treatment-status-${escapeHtml(record.status)}">
                  ${escapeHtml(statusLabel)}
                </span>

                <a
                  class="es-secondary-button es-treatment-customer-link"
                  href="/customers/?customer=${encodeURIComponent(record.customer_id)}"
                >
                  Customer
                </a>

                <button
                  class="es-button es-treatment-view-record"
                  type="button"
                  data-view-treatment="${escapeHtml(record.id)}"
                >
                  View record
                </button>
              </div>
            </article>
          `;
        }
      )
      .join("");

  document
    .querySelectorAll("[data-view-treatment]")
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const record =
              records.find(
                (item) =>
                  item.id === button.dataset.viewTreatment
              );

            if (record) {
              showTreatmentDetails(record);
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
      record.status === "complete"
        ? "Complete"
        : "Needs details"
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
      "Linked photos",
      String(Number(record.photo_count || 0))
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


  const linkedPhotos = photos.filter(
    (photo) => String(photo.treatment_record_id || "") === String(record.id)
  );

  treatmentClinicalNotes.innerHTML = `
    ${linkedPhotosSection(linkedPhotos)}

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


function linkedPhotosSection(linkedPhotos) {
  if (!linkedPhotos.length) {
    return "";
  }

  return `
    <section class="es-treatment-section">
      <h3>Linked photos</h3>
      <div class="es-treatment-photo-strip">
        ${linkedPhotos.slice(0, 6).map((photo) => `
          <a
            class="es-treatment-photo-thumb"
            href="${escapeHtml(photo.content_url)}"
            target="_blank"
            rel="noopener"
            title="${escapeHtml(photo.photo_type || photo.original_name || "Treatment photo")}"
          >
            <img
              src="${escapeHtml(photo.content_url)}"
              alt="${escapeHtml(photo.photo_type || "Treatment photo")}"
            >
            <span>${escapeHtml(formatPhotoLabel(photo.photo_type))}</span>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function formatPhotoLabel(value) {
  const normalised = String(value || "Photo").trim().toLowerCase();
  if (!normalised) return "Photo";
  return normalised.charAt(0).toUpperCase() + normalised.slice(1);
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

  if (recordId) {
    const record = records.find((item) => item.id === recordId);
    if (record) showTreatmentDetails(record);
  } else if (customerId) {
    openTreatmentForm();
    treatmentCustomer.value = customerId;
    renderAppointmentOptions();
    chooseSmartTreatmentAppointment(customerId);
  }
});
