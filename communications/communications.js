const list =
  document.getElementById(
    "communicationsList"
  );

const statusBox =
  document.getElementById(
    "communicationsStatus"
  );

const refreshButton =
  document.getElementById(
    "refreshCommunicationsButton"
  );

const runButton =
  document.getElementById(
    "runRemindersButton"
  );

const automationSummary =
  document.getElementById(
    "communicationsAutomationSummary"
  );

const typeFilter =
  document.getElementById(
    "communicationsTypeFilter"
  );

const statusFilter =
  document.getElementById(
    "communicationsStatusFilter"
  );

let rows = [];
let settings = {};


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


function money(
  minor,
  currency = "GBP"
) {
  try {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency:
          String(
            currency ||
            "GBP"
          ).toUpperCase()
      }
    ).format(
      Number(
        minor ||
        0
      ) /
      100
    );
  } catch {
    return `${currency} ${(
      Number(minor || 0) /
      100
    ).toFixed(2)}`;
  }
}


function label(type) {
  const labels = {
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
      "Package payment confirmation"
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
    row.payment_amount_minor !==
      null &&
    row.payment_amount_minor !==
      undefined
  ) {
    return money(
      row.payment_amount_minor,
      row.payment_currency
    );
  }

  if (row.start_at) {
    return formatDate(
      row.start_at
    );
  }

  return "—";
}


function renderAutomationSummary() {
  if (!automationSummary) {
    return;
  }

  const items = [
    [
      "Booking confirmations",
      settings.booking_confirmation_enabled !==
        false
        ? "On"
        : "Off"
    ],
    [
      "Appointment reminders",
      settings.reminder_enabled !==
        false
        ? `${
            settings.reminder_hours_before ||
            24
          }h before`
        : "Off"
    ],
    [
      "Outstanding form reminder",
      settings.form_reminder_enabled !==
        false
        ? `Once after ${
            settings.form_reminder_hours_after ||
            48
          }h`
        : "Off"
    ],
    [
      "Payment confirmations",
      settings.payment_receipt_enabled !==
        false
        ? "On"
        : "Off"
    ],
    [
      "Cancellations",
      settings.cancellation_enabled !==
        false
        ? "On"
        : "Off"
    ],
    [
      "Reschedules",
      settings.reschedule_enabled !==
        false
        ? "On"
        : "Off"
    ]
  ];

  automationSummary.innerHTML =
    items
      .map(
        ([name, value]) => `
          <div class="es-service-row">
            <div>
              <strong>${escapeHtml(name)}</strong>
            </div>
            <span class="es-customer-status">
              ${escapeHtml(value)}
            </span>
          </div>
        `
      )
      .join("");
}


function render() {
  list.innerHTML = "";

  const selectedType =
    typeFilter?.value ||
    "";

  const selectedStatus =
    statusFilter?.value ||
    "";

  const filtered =
    rows.filter(
      (row) =>
        (
          !selectedType ||
          group(
            row.communication_type
          ) ===
            selectedType
        ) &&
        (
          !selectedStatus ||
          row.status ===
            selectedStatus
        )
    );

  if (!filtered.length) {
    list.innerHTML = `
      <div class="es-empty-state">
        <strong>No matching communications</strong>
        <span>Automatic customer emails will appear here after they are processed.</span>
      </div>
    `;
    return;
  }

  filtered.forEach(
    (row) => {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "es-payment-row-v2";

      const customer =
        [
          row.first_name,
          row.last_name
        ]
          .filter(Boolean)
          .join(" ") ||
        row.recipient;

      item.innerHTML = `
        <div class="es-payment-cell">
          <strong>${escapeHtml(
            label(
              row.communication_type
            )
          )}</strong>
          <span>${escapeHtml(
            formatDate(
              row.sent_at ||
              row.created_at
            )
          )}</span>
        </div>

        <div class="es-payment-cell">
          <strong>${escapeHtml(
            customer
          )}</strong>
          <span>${escapeHtml(
            row.recipient
          )}</span>
        </div>

        <div class="es-payment-cell">
          <strong>${escapeHtml(
            contextText(
              row
            )
          )}</strong>
          <span>${escapeHtml(
            detailText(
              row
            )
          )}</span>
        </div>

        <div class="es-payment-cell">
          <span class="es-payment-status es-payment-status-${escapeHtml(
            row.status
          )}">
            ${escapeHtml(
              row.status
            )}
          </span>
          <small>${escapeHtml(
            row.provider ||
            "resend"
          )}</small>
        </div>

        <div class="es-payment-cell">
          <strong>${escapeHtml(
            row.subject ||
            "—"
          )}</strong>
          <small>${escapeHtml(
            row.error_details ||
            row.provider_reference ||
            ""
          )}</small>
        </div>
      `;

      list.appendChild(
        item
      );
    }
  );
}


async function loadCommunications() {
  statusBox.hidden =
    true;

  try {
    const response =
      await fetch(
        "/api/communications",
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
        "Unable to load communications."
      );
    }

    rows =
      data.communications ||
      [];

    settings =
      data.settings ||
      {};

    renderAutomationSummary();
    render();
  } catch (error) {
    statusBox.hidden =
      false;

    statusBox.className =
      "es-status error";

    statusBox.textContent =
      error.message ||
      "Unable to load communications.";
  }
}


typeFilter
  ?.addEventListener(
    "change",
    render
  );


statusFilter
  ?.addEventListener(
    "change",
    render
  );


refreshButton
  ?.addEventListener(
    "click",
    loadCommunications
  );


runButton
  ?.addEventListener(
    "click",
    async () => {
      runButton.disabled =
        true;

      statusBox.hidden =
        false;

      statusBox.className =
        "es-status";

      statusBox.textContent =
        "Checking appointment and form reminders…";

      try {
        const response =
          await fetch(
            "/api/communications",
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
            data.appointment_reminders?.sent ||
            0
          }; form reminders sent ${
            data.form_reminders?.sent ||
            0
          }; failed ${
            data.failed ||
            0
          }.`;

        await loadCommunications();
      } catch (error) {
        statusBox.className =
          "es-status error";

        statusBox.textContent =
          error.message ||
          "Unable to run reminders.";
      } finally {
        runButton.disabled =
          false;
      }
    }
  );


loadCommunications();
