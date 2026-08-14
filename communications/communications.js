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

let aftercareTemplates = {};
let selectedAftercareKey =
  "tattoo_removal";

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


function currentAftercareFromEditor() {
  const template =
    aftercareTemplates[
      selectedAftercareKey
    ];

  if (
    !template ||
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
      selectedAftercareKey,
    serviceLabel,
    sections,
    note
  };
}


function renderAftercareEditor() {
  if (!aftercareEditor) return;

  const template =
    aftercareTemplates[
      selectedAftercareKey
    ];

  if (!template) {
    aftercareEditor.innerHTML = `
      <div class="es-empty-state">
        <strong>Aftercare unavailable.</strong>
        <span>Refresh Communications and try again.</span>
      </div>
    `;
    return;
  }

  aftercareEditor.innerHTML = `
    <label class="es-aftercare-service-title">
      Email / treatment heading
      <input
        type="text"
        data-aftercare-service-label
        maxlength="120"
        value="${escapeHtml(
          template.serviceLabel ||
          ""
        )}"
      >
    </label>

    <p class="es-aftercare-help">
      Each line in an instructions box becomes one bullet point in the email.
    </p>

    ${(template.sections || [])
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
                value="${escapeHtml(title)}"
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
                    (items || []).length + 1
                  )
                )}"
              >${escapeHtml(
                (items || []).join("\n")
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
          template.note ||
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
        Restore Eselram default
      </button>
    </div>
  `;

  document
    .getElementById(
      "saveAftercareButton"
    )
    ?.addEventListener(
      "click",
      saveAftercare
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
  if (!aftercareEditor) return;

  try {
    const response =
      await fetch(
        "/api/communications/aftercare",
        {
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
        "Unable to load aftercare."
      );
    }

    aftercareTemplates =
      data.templates ||
      {};

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


async function saveAftercare() {
  const template =
    currentAftercareFromEditor();

  if (!template) return;

  try {
    const response =
      await fetch(
        "/api/communications/aftercare",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },
          body:
            JSON.stringify({
              key:
                selectedAftercareKey,
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

    aftercareTemplates[
      selectedAftercareKey
    ] = data.template;

    renderAftercareEditor();

    showAftercareStatus(
      "Aftercare saved. Future completed treatments will use this version."
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
  if (
    !window.confirm(
      "Restore the Eselram default aftercare for this treatment?"
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/communications/aftercare?key=${encodeURIComponent(
          selectedAftercareKey
        )}`,
        {
          method: "DELETE",
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
        "Unable to restore aftercare."
      );
    }

    aftercareTemplates[
      selectedAftercareKey
    ] = data.template;

    renderAftercareEditor();

    showAftercareStatus(
      "Eselram default aftercare restored."
    );
  } catch (error) {
    showAftercareStatus(
      error.message ||
      "Unable to restore aftercare.",
      "error"
    );
  }
}


aftercareTabs
  ?.querySelectorAll(
    "[data-aftercare-key]"
  )
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          selectedAftercareKey =
            button.dataset.aftercareKey;

          aftercareTabs
            .querySelectorAll(
              "[data-aftercare-key]"
            )
            .forEach(
              item =>
                item.classList.toggle(
                  "active",
                  item === button
                )
            );

          if (aftercareStatus) {
            aftercareStatus.hidden = true;
          }

          renderAftercareEditor();
        }
      );
    }
  );


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
loadAftercare();
