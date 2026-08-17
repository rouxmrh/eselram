const list =
  document.getElementById("communicationsList");

const statusBox =
  document.getElementById("communicationsStatus");

const refreshButton =
  document.getElementById("refreshCommunicationsButton");

const runButton =
  document.getElementById("runRemindersButton");

const automationSummary =
  document.getElementById("communicationsAutomationSummary");

const statusFilter =
  document.getElementById("communicationsStatusFilter");

const searchInput =
  document.getElementById("communicationsSearch");

const sortSelect =
  document.getElementById("communicationsSort");

const totalCount =
  document.getElementById("communicationsTotalCount");

const sentCount =
  document.getElementById("communicationsSentCount");

const pendingCount =
  document.getElementById("communicationsPendingCount");

const failedCount =
  document.getElementById("communicationsFailedCount");

const drawer =
  document.getElementById("communicationsDrawer");

const drawerBackdrop =
  document.getElementById("communicationsDrawerBackdrop");

const drawerTitle =
  document.getElementById("communicationsDrawerTitle");

const drawerContent =
  document.getElementById("communicationsDrawerContent");

const closeDrawerButton =
  document.getElementById("closeCommunicationsDrawer");

const aftercareEditor =
  document.getElementById("aftercareEditor");

const aftercareStatus =
  document.getElementById("aftercareStatus");

const aftercareTabs =
  document.getElementById("aftercareTabs");

const emailTemplateTabs =
  document.getElementById(
    "emailTemplateTabs"
  );

const emailTemplateEditor =
  document.getElementById(
    "emailTemplateEditor"
  );

const emailTemplateStatus =
  document.getElementById(
    "emailTemplateStatus"
  );

const bookingCopyTabs =
  document.getElementById(
    "bookingCopyTabs"
  );

const bookingCopyEditor =
  document.getElementById(
    "bookingCopyEditor"
  );

const bookingCopyStatus =
  document.getElementById(
    "bookingCopyStatus"
  );

let contentData = null;
let selectedEmailKey =
  "booking_confirmation";
let selectedBookingGroup =
  "";

let aftercareServices = [];
let selectedAftercareKey = "";

let rows = [];
let settings = {};
let selectedCategory = "";


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(
      new Date(
        String(value)
          .replace(" ", "T") +
        "Z"
      )
    );
  } catch {
    return value;
  }
}


function money(minor, currency = "GBP") {
  try {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency:
          String(currency || "GBP")
            .toUpperCase()
      }
    ).format(
      Number(minor || 0) / 100
    );
  } catch {
    return `${currency} ${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}


function label(type) {
  const labels = {
    booking_confirmation:
      "Booking confirmation",
    appointment_reminder:
      "Appointment reminder",
    cancellation_confirmation:
      "Cancellation confirmation",
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
  };

  return labels[type] ||
    type ||
    "Email";
}


function group(type) {
  if (
    [
      "client_form_request",
      "client_form_reminder"
    ].includes(type)
  ) {
    return "forms";
  }

  if (
    [
      "payment_link",
      "payment_receipt",
      "package_payment_confirmation"
    ].includes(type)
  ) {
    return "payments";
  }

  if (
    type ===
    "appointment_reminder"
  ) {
    return "reminders";
  }

  return "appointment";
}


function contextText(row) {
  if (row.package_name) {
    return row.package_name;
  }

  if (row.form_name) {
    return row.form_name;
  }

  if (row.service_name) {
    return row.service_name;
  }

  return "—";
}


function detailText(row) {
  if (
    row.payment_id &&
    row.payment_amount_minor !== null &&
    row.payment_amount_minor !== undefined
  ) {
    return money(
      row.payment_amount_minor,
      row.payment_currency
    );
  }

  if (row.start_at) {
    return formatDate(row.start_at);
  }

  return "—";
}


function customerName(row) {
  return [
    row.first_name,
    row.last_name
  ]
    .filter(Boolean)
    .join(" ") ||
    row.recipient ||
    "Customer";
}


function communicationDateValue(row) {
  const value =
    row.sent_at ||
    row.created_at ||
    "";

  const parsed =
    new Date(
      String(value)
        .replace(" ", "T") +
      "Z"
    ).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function renderSummary() {
  if (totalCount) {
    totalCount.textContent = rows.length;
  }

  if (sentCount) {
    sentCount.textContent =
      rows.filter(
        row => row.status === "sent"
      ).length;
  }

  if (pendingCount) {
    pendingCount.textContent =
      rows.filter(
        row => row.status === "pending"
      ).length;
  }

  if (failedCount) {
    failedCount.textContent =
      rows.filter(
        row => row.status === "failed"
      ).length;
  }
}


function renderAutomationSummary() {
  if (!automationSummary) {
    return;
  }

  const items = [
    [
      "Booking confirmations",
      settings.booking_confirmation_enabled !== false
        ? "On"
        : "Off"
    ],
    [
      "Appointment reminders",
      settings.reminder_enabled !== false
        ? `${settings.reminder_hours_before || 24}h before`
        : "Off"
    ],
    [
      "Outstanding form reminder",
      settings.form_reminder_enabled !== false
        ? `After ${settings.form_reminder_hours_after || 48}h`
        : "Off"
    ],
    [
      "Payment confirmations",
      settings.payment_receipt_enabled !== false
        ? "On"
        : "Off"
    ],
    [
      "Cancellations",
      settings.cancellation_enabled !== false
        ? "On"
        : "Off"
    ],
    [
      "Reschedules",
      settings.reschedule_enabled !== false
        ? "On"
        : "Off"
    ]
  ];

  automationSummary.innerHTML =
    items
      .map(
        ([name, value]) => `
          <div class="es-comms-automation-item">
            <strong>${escapeHtml(name)}</strong>
            <span class="es-comms-automation-value">
              ${escapeHtml(value)}
            </span>
          </div>
        `
      )
      .join("");
}


function render() {
  const query =
    String(searchInput?.value || "")
      .trim()
      .toLowerCase();

  const selectedStatus =
    statusFilter?.value ||
    "";

  const filtered =
    rows
      .filter(
        row => {

          if (
            selectedCategory &&
            group(row.communication_type) !==
              selectedCategory
          ) {
            return false;
          }

          if (
            selectedStatus &&
            row.status !==
              selectedStatus
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable = [
            customerName(row),
            row.recipient,
            row.subject,
            row.service_name,
            row.package_name,
            row.form_name,
            label(row.communication_type),
            row.status,
            row.provider_reference
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(query);
        }
      )
      .sort(
        (a, b) =>
          sortSelect?.value === "oldest"
            ? communicationDateValue(a) -
              communicationDateValue(b)
            : communicationDateValue(b) -
              communicationDateValue(a)
      );

  if (!filtered.length) {
    list.innerHTML = `
      <div class="es-empty-state">
        <strong>No matching communications</strong>
        <span>Try changing your search or filters.</span>
      </div>
    `;
    return;
  }

  list.innerHTML =
    filtered
      .map(
        row => `
          <article
            class="es-comms-row ${
              row.status === "failed"
                ? "is-failed"
                : ""
            }"
          >
            <div class="es-comms-cell">
              <strong>${escapeHtml(label(row.communication_type))}</strong>
              <span>${escapeHtml(formatDate(row.sent_at || row.created_at))}</span>
            </div>

            <div class="es-comms-cell">
              <strong>${escapeHtml(customerName(row))}</strong>
              <span>${escapeHtml(row.recipient || "—")}</span>
            </div>

            <div class="es-comms-cell">
              <strong>${escapeHtml(contextText(row))}</strong>
              <span>${escapeHtml(row.subject || detailText(row))}</span>
            </div>

            <div class="es-comms-cell">
              <span class="es-comms-status es-comms-status-${escapeHtml(row.status || "pending")}">
                ${escapeHtml(row.status || "pending")}
              </span>
              <small>${escapeHtml(row.provider || "resend")}</small>
            </div>

            <div class="es-comms-cell">
              <button
                class="es-secondary-button es-comms-view-button"
                type="button"
                data-view-communication="${escapeHtml(row.id)}"
              >
                View
              </button>
            </div>
          </article>
        `
      )
      .join("");

  document
    .querySelectorAll("[data-view-communication]")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const row =
              rows.find(
                item =>
                  item.id ===
                  button.dataset.viewCommunication
              );

            if (row) {
              openDrawer(row);
            }
          }
        );
      }
    );
}


function openDrawer(row) {
  drawerTitle.textContent =
    label(row.communication_type);

  const customerLink =
    row.customer_id
      ? `
        <a
          class="es-secondary-button"
          href="/customers/?customer=${encodeURIComponent(row.customer_id)}"
          style="text-decoration:none;"
        >
          Open customer
        </a>
      `
      : "";

  const errorBlock =
    row.error_details
      ? `
        <div class="es-comms-detail-section">
          <h3>Delivery error</h3>
          <div class="es-comms-error">
            ${escapeHtml(row.error_details)}
          </div>
        </div>
      `
      : "";

  drawerContent.innerHTML = `
    <div class="es-comms-detail-grid">
      <div class="es-comms-detail">
        <span>Customer</span>
        <strong>${escapeHtml(customerName(row))}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Status</span>
        <strong>
          <span class="es-comms-status es-comms-status-${escapeHtml(row.status || "pending")}">
            ${escapeHtml(row.status || "pending")}
          </span>
        </strong>
      </div>

      <div class="es-comms-detail es-comms-detail-full">
        <span>Recipient</span>
        <strong>${escapeHtml(row.recipient || "—")}</strong>
      </div>

      <div class="es-comms-detail es-comms-detail-full">
        <span>Subject</span>
        <strong>${escapeHtml(row.subject || "—")}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Type</span>
        <strong>${escapeHtml(label(row.communication_type))}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Context</span>
        <strong>${escapeHtml(contextText(row))}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Sent / created</span>
        <strong>${escapeHtml(formatDate(row.sent_at || row.created_at))}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Appointment / amount</span>
        <strong>${escapeHtml(detailText(row))}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Provider</span>
        <strong>${escapeHtml(row.provider || "resend")}</strong>
      </div>

      <div class="es-comms-detail">
        <span>Provider reference</span>
        <strong>${escapeHtml(row.provider_reference || "—")}</strong>
      </div>
    </div>

    ${errorBlock}

    <div class="es-comms-drawer-actions">
      ${customerLink}
      ${
        row.appointment_id
          ? `
            <a
              class="es-secondary-button"
              href="/bookings/?view=bookings&booking=${encodeURIComponent(row.appointment_id)}"
              style="text-decoration:none;"
            >
              Open booking
            </a>
          `
          : ""
      }
    </div>
  `;

  drawer.classList.add("is-open");
  drawerBackdrop.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
}


function closeDrawer() {
  drawer.classList.remove("is-open");
  drawerBackdrop.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}




function showContentStatus(
  element,
  message,
  type = "success"
) {
  if (!element) {
    return;
  }

  element.hidden =
    false;

  element.className =
    `es-status es-content-status ${type}`;

  element.textContent =
    message;
}


function sampleVariables() {
  return {
    customer_name:
      "Alex",
    business_name:
      "Your Business",
    service_name:
      "Treatment",
    appointment_date:
      "21 August 2026 at 18:00",
    package_name:
      "Treatment Package",
    form_name:
      "Consultation Form",
    amount:
      "£30.00",
    default_subject:
      "Eselram smart subject",
    default_title:
      "Eselram smart heading",
    default_intro:
      "Eselram smart introduction",
    default_closing:
      "Eselram keeps any booking-specific wording here automatically."
  };
}


function previewTemplateText(
  value,
  extra = {}
) {
  const vars = {
    ...sampleVariables(),
    ...extra
  };

  return String(
    value ||
    ""
  ).replace(
    /\{\{\s*([a-z0-9_]+)\s*\}\}/gi,
    (
      match,
      key
    ) => (
      Object.prototype
        .hasOwnProperty
        .call(
          vars,
          key
        )
        ? String(
            vars[key] ??
            ""
          )
        : match
    )
  );
}


function renderEmailTabs() {
  if (
    !emailTemplateTabs ||
    !contentData
  ) {
    return;
  }

  const templates =
    contentData.email_templates ||
    {};

  const customised =
    new Set(
      contentData.email_customised ||
      []
    );

  emailTemplateTabs.innerHTML =
    Object.entries(
      templates
    )
      .map(
        ([
          key,
          template
        ]) => `
          <button
            class="es-content-tab ${
              key ===
                selectedEmailKey
                ? "active"
                : ""
            }"
            type="button"
            data-email-template="${escapeHtml(
              key
            )}"
          >
            ${escapeHtml(
              template.label ||
              key
            )}${
              customised.has(
                key
              )
                ? " · Custom"
                : ""
            }
          </button>
        `
      )
      .join("");

  emailTemplateTabs
    .querySelectorAll(
      "[data-email-template]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            selectedEmailKey =
              button.dataset
                .emailTemplate;

            renderEmailTabs();
            renderEmailEditor();
          }
        );
      }
    );
}


function currentEmailEditorValue() {
  if (!emailTemplateEditor) {
    return null;
  }

  return {
    subject:
      String(
        emailTemplateEditor
          .querySelector(
            "[data-email-subject]"
          )?.value ||
        ""
      ).trim(),

    title:
      String(
        emailTemplateEditor
          .querySelector(
            "[data-email-title]"
          )?.value ||
        ""
      ).trim(),

    intro:
      String(
        emailTemplateEditor
          .querySelector(
            "[data-email-intro]"
          )?.value ||
        ""
      ).trim(),

    closing:
      String(
        emailTemplateEditor
          .querySelector(
            "[data-email-closing]"
          )?.value ||
        ""
      ).trim()
  };
}


function updateEmailPreview() {
  const values =
    currentEmailEditorValue();

  if (!values) return;

  const subject =
    emailTemplateEditor
      .querySelector(
        "[data-preview-subject]"
      );

  const title =
    emailTemplateEditor
      .querySelector(
        "[data-preview-title]"
      );

  const intro =
    emailTemplateEditor
      .querySelector(
        "[data-preview-intro]"
      );

  const closing =
    emailTemplateEditor
      .querySelector(
        "[data-preview-closing]"
      );

  if (subject) {
    subject.textContent =
      previewTemplateText(
        values.subject
      );
  }

  if (title) {
    title.textContent =
      previewTemplateText(
        values.title
      );
  }

  if (intro) {
    intro.textContent =
      previewTemplateText(
        values.intro
      );
  }

  if (closing) {
    closing.textContent =
      previewTemplateText(
        values.closing
      );
  }
}


function renderEmailEditor() {
  if (
    !emailTemplateEditor ||
    !contentData
  ) {
    return;
  }

  const template =
    contentData
      .email_templates?.[
        selectedEmailKey
      ];

  if (!template) {
    emailTemplateEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>Email template unavailable.</strong>
      </div>
    `;
    return;
  }

  emailTemplateEditor.innerHTML = `
    <div class="es-content-fields">
      <div>
        <strong>${escapeHtml(
          template.label ||
          "Customer email"
        )}</strong>
        <p class="es-content-help">
          ${escapeHtml(
            template.description ||
            ""
          )}
          Secure links, payment amounts, appointment details and system buttons remain controlled by Eselram.
        </p>
      </div>

      <label>
        Subject
        <input
          type="text"
          maxlength="240"
          data-email-subject
          value="${escapeHtml(
            template.subject ||
            ""
          )}"
        >
      </label>

      <label>
        Heading
        <input
          type="text"
          maxlength="240"
          data-email-title
          value="${escapeHtml(
            template.title ||
            ""
          )}"
        >
      </label>

      <label>
        Main message
        <textarea
          maxlength="3000"
          data-email-intro
        >${escapeHtml(
          template.intro ||
          ""
        )}</textarea>
      </label>

      <label>
        Closing message
        <textarea
          maxlength="3000"
          data-email-closing
        >${escapeHtml(
          template.closing ||
          ""
        )}</textarea>
      </label>

      <p class="es-content-help">
        Useful variables: {{customer_name}}, {{business_name}}, {{service_name}},
        {{form_name}}, {{amount}}. {{default_closing}} keeps Eselram's smart
        booking-specific closing where applicable.
      </p>

      <div class="es-content-actions">
        <button
          id="saveEmailTemplateButton"
          class="es-button"
          type="button"
        >
          Save wording
        </button>

        <button
          id="restoreEmailTemplateButton"
          class="es-secondary-button"
          type="button"
        >
          Restore Eselram default
        </button>
      </div>
    </div>

    <aside class="es-content-preview">
      <p class="es-content-preview-label">
        Preview
      </p>
      <span
        class="es-content-preview-subject"
        data-preview-subject
      ></span>
      <h3 data-preview-title></h3>
      <p data-preview-intro></p>
      <div
        style="height:44px;border-radius:9px;background:var(--es-primary);color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;margin:16px 0;"
      >
        Protected Eselram content / button
      </div>
      <p data-preview-closing></p>
    </aside>
  `;

  emailTemplateEditor
    .querySelectorAll(
      "input, textarea"
    )
    .forEach(
      field =>
        field.addEventListener(
          "input",
          updateEmailPreview
        )
    );

  document
    .getElementById(
      "saveEmailTemplateButton"
    )
    ?.addEventListener(
      "click",
      saveEmailTemplate
    );

  document
    .getElementById(
      "restoreEmailTemplateButton"
    )
    ?.addEventListener(
      "click",
      restoreEmailTemplate
    );

  updateEmailPreview();
}


async function saveEmailTemplate() {
  const template =
    currentEmailEditorValue();

  if (!template) return;

  try {
    const response =
      await fetch(
        "/api/communications/content",
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
              kind:
                "email",
              key:
                selectedEmailKey,
              template
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
        "Unable to save email wording."
      );
    }

    await loadContentManager();

    showContentStatus(
      emailTemplateStatus,
      "Email wording saved. Future emails will use this version."
    );
  } catch (error) {
    showContentStatus(
      emailTemplateStatus,
      error.message ||
      "Unable to save email wording.",
      "error"
    );
  }
}


async function restoreEmailTemplate() {
  if (
    !window.confirm(
      "Restore the Eselram default wording for this email?"
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/communications/content?kind=email&key=${encodeURIComponent(
          selectedEmailKey
        )}`,
        {
          method:
            "DELETE",
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
        "Unable to restore email wording."
      );
    }

    await loadContentManager();

    showContentStatus(
      emailTemplateStatus,
      "Eselram default email wording restored."
    );
  } catch (error) {
    showContentStatus(
      emailTemplateStatus,
      error.message ||
      "Unable to restore email wording.",
      "error"
    );
  }
}


function renderBookingTabs() {
  if (
    !bookingCopyTabs ||
    !contentData
  ) {
    return;
  }

  const groups =
    contentData.booking_groups ||
    [];

  if (
    !selectedBookingGroup &&
    groups.length
  ) {
    selectedBookingGroup =
      groups[0].name;
  }

  bookingCopyTabs.innerHTML =
    groups
      .map(
        group => `
          <button
            class="es-content-tab ${
              group.name ===
                selectedBookingGroup
                ? "active"
                : ""
            }"
            type="button"
            data-booking-copy-group="${escapeHtml(
              group.name
            )}"
          >
            ${escapeHtml(
              group.name
            )}${
              group.customised
                ? " · Custom"
                : ""
            }
          </button>
        `
      )
      .join("");

  bookingCopyTabs
    .querySelectorAll(
      "[data-booking-copy-group]"
    )
    .forEach(
      button =>
        button.addEventListener(
          "click",
          () => {
            selectedBookingGroup =
              button.dataset
                .bookingCopyGroup;

            renderBookingTabs();
            renderBookingCopyEditor();
          }
        )
    );
}


function selectedBookingCopy() {
  return (
    contentData
      ?.booking_groups
      ?.find(
        item =>
          item.name ===
          selectedBookingGroup
      ) ||
    null
  );
}


function renderBookingCopyEditor() {
  if (
    !bookingCopyEditor ||
    !contentData
  ) {
    return;
  }

  const group =
    selectedBookingCopy();

  if (!group) {
    bookingCopyEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>No public booking groups found.</strong>
        <span>Add active services in Services first.</span>
      </div>
    `;
    return;
  }

  const variables =
    contentData
      .booking_variables?.[
        group.kind
      ] ||
    [];

  bookingCopyEditor.innerHTML = `
    <div class="es-booking-copy-card">
      <div>
        <strong>${escapeHtml(
          group.name
        )}</strong>
        <p class="es-content-help">
          This wording appears on /book for this service group. The variables
          below keep prices, consultation duration and booking rules linked to
          the actual service configuration.
        </p>
      </div>

      <label>
        Customer-facing booking message
        <textarea
          id="bookingCopyText"
          maxlength="4000"
        >${escapeHtml(
          group.copy ||
          ""
        )}</textarea>
      </label>

      ${
        variables.length
          ? `
            <div class="es-variable-chips">
              ${variables
                .map(
                  variable => `
                    <span class="es-variable-chip">
                      ${escapeHtml(
                        variable
                      )}
                    </span>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }

      <div class="es-content-preview">
        <p class="es-content-preview-label">
          Booking page preview
        </p>
        <h3>${escapeHtml(
          group.name
        )}</h3>
        <p id="bookingCopyPreview"></p>
      </div>

      <div class="es-content-actions">
        <button
          id="saveBookingCopyButton"
          class="es-button"
          type="button"
        >
          Save wording
        </button>

        <button
          id="restoreBookingCopyButton"
          class="es-secondary-button"
          type="button"
        >
          Restore Eselram default
        </button>
      </div>
    </div>
  `;

  const field =
    document.getElementById(
      "bookingCopyText"
    );

  const updatePreview =
    () => {
      const preview =
        document.getElementById(
          "bookingCopyPreview"
        );

      if (!preview) return;

      preview.textContent =
        previewTemplateText(
          field?.value ||
          "",
          {
            group_name:
              group.name,
            consultation_duration:
              "30",
            consultation_payment:
              "£30.00 online",
            consultation_credit_sentence:
              "Any unused consultation credit will be deducted from the first eligible treatment or package you go on to purchase.",
            patch_test_sentence:
              "A patch test is required before treatment.",
            post_consultation_sentence:
              "Existing clients can book an eligible treatment online using the same customer details held by the business."
          }
        );
    };

  field?.addEventListener(
    "input",
    updatePreview
  );

  document
    .getElementById(
      "saveBookingCopyButton"
    )
    ?.addEventListener(
      "click",
      saveBookingCopy
    );

  document
    .getElementById(
      "restoreBookingCopyButton"
    )
    ?.addEventListener(
      "click",
      restoreBookingCopy
    );

  updatePreview();
}


async function saveBookingCopy() {
  const group =
    selectedBookingCopy();

  const field =
    document.getElementById(
      "bookingCopyText"
    );

  if (
    !group ||
    !field
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/communications/content",
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
              kind:
                "booking_copy",
              group:
                group.name,
              copy:
                field.value
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
        "Unable to save booking wording."
      );
    }

    await loadContentManager();

    showContentStatus(
      bookingCopyStatus,
      "Booking wording saved. /book will use this version."
    );
  } catch (error) {
    showContentStatus(
      bookingCopyStatus,
      error.message ||
      "Unable to save booking wording.",
      "error"
    );
  }
}


async function restoreBookingCopy() {
  const group =
    selectedBookingCopy();

  if (!group) return;

  if (
    !window.confirm(
      "Restore the Eselram default booking wording for this service group?"
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/communications/content?kind=booking_copy&group=${encodeURIComponent(
          group.name
        )}`,
        {
          method:
            "DELETE",
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
        "Unable to restore booking wording."
      );
    }

    await loadContentManager();

    showContentStatus(
      bookingCopyStatus,
      "Eselram default booking wording restored."
    );
  } catch (error) {
    showContentStatus(
      bookingCopyStatus,
      error.message ||
      "Unable to restore booking wording.",
      "error"
    );
  }
}


async function loadContentManager() {
  if (
    !emailTemplateEditor ||
    !bookingCopyEditor
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/communications/content",
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
      response.status ===
      401
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
        "Unable to load communication content."
      );
    }

    contentData =
      data;

    if (
      !contentData
        .email_templates?.[
          selectedEmailKey
        ]
    ) {
      selectedEmailKey =
        Object.keys(
          contentData
            .email_templates ||
          {}
        )[0] ||
        "";
    }

    if (
      selectedBookingGroup &&
      !contentData
        .booking_groups
        ?.some(
          item =>
            item.name ===
            selectedBookingGroup
        )
    ) {
      selectedBookingGroup =
        "";
    }

    renderEmailTabs();
    renderEmailEditor();
    renderBookingTabs();
    renderBookingCopyEditor();
  } catch (error) {
    emailTemplateEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>Unable to load email templates.</strong>
        <span>${escapeHtml(
          error.message ||
          "Please refresh the page."
        )}</span>
      </div>
    `;

    bookingCopyEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>Unable to load booking messages.</strong>
      </div>
    `;
  }
}


function showAftercareStatus(
  message,
  type = "success"
) {
  if (!aftercareStatus) return;

  aftercareStatus.hidden = false;
  aftercareStatus.className =
    `es-status ${type}`;
  aftercareStatus.textContent =
    message;
}


function selectedAftercareService() {
  return (
    aftercareServices.find(
      item =>
        item.service_id ===
        selectedAftercareKey
    ) ||
    null
  );
}


function renderAftercareTabs() {
  if (!aftercareTabs) {
    return;
  }

  if (!aftercareServices.length) {
    aftercareTabs.innerHTML = "";
    return;
  }

  if (
    !selectedAftercareKey ||
    !aftercareServices.some(
      item =>
        item.service_id ===
        selectedAftercareKey
    )
  ) {
    selectedAftercareKey =
      aftercareServices[0]
        .service_id;
  }

  aftercareTabs.innerHTML =
    aftercareServices
      .map(
        item => `
          <button
            class="es-aftercare-tab ${
              item.service_id ===
                selectedAftercareKey
                ? "active"
                : ""
            }"
            type="button"
            data-aftercare-key="${escapeHtml(
              item.service_id
            )}"
          >
            ${escapeHtml(
              item.service_name
            )}${
              item.enabled
                ? ""
                : " · Off"
            }
          </button>
        `
      )
      .join("");

  aftercareTabs
    .querySelectorAll(
      "[data-aftercare-key]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            selectedAftercareKey =
              button.dataset
                .aftercareKey;

            if (
              aftercareStatus
            ) {
              aftercareStatus.hidden =
                true;
            }

            renderAftercareTabs();
            renderAftercareEditor();
          }
        );
      }
    );
}


function currentAftercareFromEditor() {
  const service =
    selectedAftercareService();

  if (
    !service ||
    !aftercareEditor
  ) {
    return null;
  }

  const serviceLabel =
    String(
      aftercareEditor.querySelector(
        "[data-aftercare-service-label]"
      )?.value ||
      ""
    ).trim();

  const sections =
    [
      ...aftercareEditor.querySelectorAll(
        "[data-aftercare-section]"
      )
    ].map(
      card => {
        const title =
          String(
            card.querySelector(
              "[data-aftercare-section-title]"
            )?.value ||
            ""
          ).trim();

        const items =
          String(
            card.querySelector(
              "[data-aftercare-section-items]"
            )?.value ||
            ""
          )
            .split("\n")
            .map(
              value =>
                value
                  .replace(
                    /^\s*[-•]\s*/,
                    ""
                  )
                  .trim()
            )
            .filter(Boolean);

        return [
          title,
          items
        ];
      }
    );

  const note =
    String(
      aftercareEditor.querySelector(
        "[data-aftercare-note]"
      )?.value ||
      ""
    ).trim();

  return {
    key:
      service.template?.key ||
      "custom_service",
    serviceLabel,
    sections,
    note
  };
}


function renderAftercareEditor() {
  if (!aftercareEditor) {
    return;
  }

  const service =
    selectedAftercareService();

  if (!service) {
    aftercareEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>No treatment services available.</strong>
        <span>Add an active treatment service in Services first.</span>
      </div>
    `;
    return;
  }

  const template =
    service.template;

  const starterText =
    service.has_eselram_starter
      ? "This service uses an Eselram starter aftercare by default."
      : "Aftercare for this service is optional and starts off until you enable it.";

  if (
    !service.enabled
  ) {
    aftercareEditor.innerHTML = `
      <div class="es-aftercare-service-toolbar">
        <div class="es-aftercare-service-state">
          <strong>${escapeHtml(
            service.service_name
          )}</strong>
          <span>${escapeHtml(
            starterText
          )}</span>
        </div>

        <label class="es-aftercare-toggle">
          <input
            id="aftercareEnabledToggle"
            type="checkbox"
          >
          Send automatically when treatment is marked complete
        </label>
      </div>

      <div class="es-aftercare-off">
        <strong>Aftercare is off</strong>
        <span>
          Completing this treatment will not send an aftercare email.
          Enable it to start with a safe editable template.
        </span>
      </div>
    `;

    document
      .getElementById(
        "aftercareEnabledToggle"
      )
      ?.addEventListener(
        "change",
        event => {
          if (
            event.target.checked
          ) {
            service.enabled =
              true;

            renderAftercareEditor();
          }
        }
      );

    return;
  }

  aftercareEditor.innerHTML = `
    <div class="es-aftercare-service-toolbar">
      <div class="es-aftercare-service-state">
        <strong>${escapeHtml(
          service.service_name
        )}</strong>
        <span>${escapeHtml(
          starterText
        )}</span>
      </div>

      <label class="es-aftercare-toggle">
        <input
          id="aftercareEnabledToggle"
          type="checkbox"
          checked
        >
        Send automatically when treatment is marked complete
      </label>
    </div>

    <label class="es-aftercare-service-title">
      Email / treatment heading
      <input
        type="text"
        data-aftercare-service-label
        maxlength="120"
        value="${escapeHtml(
          template?.serviceLabel ||
          service.service_name ||
          ""
        )}"
      >
    </label>

    <p class="es-aftercare-help">
      Each line in an instructions box becomes one bullet point in the email.
      The email still uses the business logo and branding configured in Eselram.
    </p>

    ${(template?.sections || [])
      .map(
        ([title, items], index) => `
          <section
            class="es-aftercare-section-card"
            data-aftercare-section="${index}"
          >
            <label>
              Section heading
              <input
                type="text"
                maxlength="120"
                data-aftercare-section-title
                value="${escapeHtml(
                  title
                )}"
              >
            </label>

            <label>
              Instructions
              <textarea
                data-aftercare-section-items
                rows="${Math.max(
                  5,
                  Math.min(
                    12,
                    (items || [])
                      .length + 1
                  )
                )}"
              >${escapeHtml(
                (items || [])
                  .join("\n")
              )}</textarea>
            </label>
          </section>
        `
      )
      .join("")}

    <section class="es-aftercare-note">
      <label>
        Important note
        <textarea
          data-aftercare-note
          rows="4"
        >${escapeHtml(
          template?.note ||
          ""
        )}</textarea>
      </label>
    </section>

    <div class="es-aftercare-actions">
      <button
        id="saveAftercareButton"
        class="es-button"
        type="button"
      >
        Save changes
      </button>

      <button
        id="restoreAftercareButton"
        class="es-secondary-button"
        type="button"
      >
        ${
          service.has_eselram_starter
            ? "Restore Eselram default"
            : "Reset & turn off"
        }
      </button>
    </div>
  `;

  document
    .getElementById(
      "aftercareEnabledToggle"
    )
    ?.addEventListener(
      "change",
      async event => {
        if (
          !event.target.checked
        ) {
          await saveAftercare(
            false
          );
        }
      }
    );

  document
    .getElementById(
      "saveAftercareButton"
    )
    ?.addEventListener(
      "click",
      () =>
        saveAftercare(
          true
        )
    );

  document
    .getElementById(
      "restoreAftercareButton"
    )
    ?.addEventListener(
      "click",
      restoreAftercare
    );
}


async function loadAftercare() {
  if (!aftercareEditor) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/communications/aftercare",
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
        "Unable to load aftercare."
      );
    }

    aftercareServices =
      data.services ||
      [];

    if (
      selectedAftercareKey &&
      !aftercareServices.some(
        item =>
          item.service_id ===
          selectedAftercareKey
      )
    ) {
      selectedAftercareKey =
        "";
    }

    if (
      !selectedAftercareKey &&
      aftercareServices.length
    ) {
      selectedAftercareKey =
        aftercareServices[0]
          .service_id;
    }

    renderAftercareTabs();
    renderAftercareEditor();
  } catch (error) {
    aftercareEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>Unable to load aftercare.</strong>
        <span>${escapeHtml(
          error.message ||
          "Please refresh the page."
        )}</span>
      </div>
    `;
  }
}


async function saveAftercare(
  enabled = true
) {
  const service =
    selectedAftercareService();

  if (!service) {
    return;
  }

  const template =
    currentAftercareFromEditor() ||
    service.template;

  try {
    const response =
      await fetch(
        "/api/communications/aftercare",
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
              service_id:
                service.service_id,
              enabled,
              template
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
        "Unable to save aftercare."
      );
    }

    service.enabled =
      data.enabled;

    service.customised =
      true;

    service.template =
      data.template;

    renderAftercareTabs();
    renderAftercareEditor();

    showAftercareStatus(
      data.enabled
        ? "Aftercare saved. Future completed treatments for this service will use this version."
        : "Aftercare is now off for this service."
    );
  } catch (error) {
    showAftercareStatus(
      error.message ||
      "Unable to save aftercare.",
      "error"
    );
  }
}


async function restoreAftercare() {
  const service =
    selectedAftercareService();

  if (!service) {
    return;
  }

  const message =
    service.has_eselram_starter
      ? "Restore the Eselram starter aftercare for this service?"
      : "Remove this custom aftercare and turn aftercare off for this service?";

  if (
    !window.confirm(
      message
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/communications/aftercare?service_id=${encodeURIComponent(
          service.service_id
        )}`,
        {
          method:
            "DELETE",
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
        "Unable to reset aftercare."
      );
    }

    service.enabled =
      data.enabled;

    service.customised =
      false;

    service.template =
      data.template;

    renderAftercareTabs();
    renderAftercareEditor();

    showAftercareStatus(
      data.restored_to ===
        "eselram_starter"
        ? "Eselram starter aftercare restored."
        : "Custom aftercare removed. Aftercare is off for this service."
    );
  } catch (error) {
    showAftercareStatus(
      error.message ||
      "Unable to reset aftercare.",
      "error"
    );
  }
}


async function loadCommunications() {
  statusBox.hidden = true;

  try {
    const response =
      await fetch(
        "/api/communications",
        {
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

    if (response.status === 401) {
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
        "Unable to load communications."
      );
    }

    rows =
      data.communications ||
      [];

    settings =
      data.settings ||
      {};

    renderSummary();
    renderAutomationSummary();
    render();

  } catch (error) {
    statusBox.hidden = false;
    statusBox.className =
      "es-status error";
    statusBox.textContent =
      error.message ||
      "Unable to load communications.";
  }
}


document
  .querySelectorAll("[data-comms-category]")
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          selectedCategory =
            button.dataset.commsCategory ||
            "";

          document
            .querySelectorAll("[data-comms-category]")
            .forEach(
              item => {
                item.classList.toggle(
                  "active",
                  item === button
                );
              }
            );

          render();
        }
      );
    }
  );


searchInput
  ?.addEventListener(
    "input",
    render
  );


statusFilter
  ?.addEventListener(
    "change",
    render
  );


sortSelect
  ?.addEventListener(
    "change",
    render
  );


refreshButton
  ?.addEventListener(
    "click",
    loadCommunications
  );


closeDrawerButton
  ?.addEventListener(
    "click",
    closeDrawer
  );


drawerBackdrop
  ?.addEventListener(
    "click",
    closeDrawer
  );


document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      drawer.classList.contains("is-open")
    ) {
      closeDrawer();
    }
  }
);


runButton
  ?.addEventListener(
    "click",
    async () => {
      runButton.disabled = true;

      statusBox.hidden = false;
      statusBox.className =
        "es-status";
      statusBox.textContent =
        "Checking appointment and form reminders…";

      try {
        const response =
          await fetch(
            "/api/communications",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json"
              },
              body:
                JSON.stringify({
                  action:
                    "run_reminders"
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
            "Unable to run reminders."
          );
        }

        statusBox.className =
          "es-status success";

        statusBox.textContent =
          `Automation check complete. Appointment reminders sent ${
            data.appointment_reminders?.sent || 0
          }; form reminders sent ${
            data.form_reminders?.sent || 0
          }; failed ${
            data.failed || 0
          }.`;

        await loadCommunications();

      } catch (error) {
        statusBox.className =
          "es-status error";
        statusBox.textContent =
          error.message ||
          "Unable to run reminders.";
      } finally {
        runButton.disabled = false;
      }
    }
  );


loadCommunications();
loadContentManager();
loadAftercare();
