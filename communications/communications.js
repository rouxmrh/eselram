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

function label(type) {
  const labels = {
    booking_confirmation:
      "Booking confirmation",
    appointment_reminder:
      "Appointment reminder",
    cancellation_confirmation:
      "Cancellation",
    reschedule_confirmation:
      "Appointment updated"
  };

  return labels[type] ||
    type ||
    "Email";
}

function render(rows) {
  list.innerHTML = "";

  if (!rows.length) {
    list.innerHTML = `
      <div class="es-empty-state">
        <strong>No communications yet</strong>
        <span>Automatic customer emails will appear here after they are sent.</span>
      </div>
    `;
    return;
  }

  rows.forEach(
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
          <strong>${label(row.communication_type)}</strong>
          <span>${formatDate(row.sent_at || row.created_at)}</span>
        </div>

        <div class="es-payment-cell">
          <strong>${customer}</strong>
          <span>${row.recipient}</span>
        </div>

        <div class="es-payment-cell">
          <strong>${row.service_name || "—"}</strong>
          <span>${row.start_at ? formatDate(row.start_at) : "—"}</span>
        </div>

        <div class="es-payment-cell">
          <span class="es-payment-status es-payment-status-${row.status}">
            ${row.status}
          </span>
          <small>${row.provider || "resend"}</small>
        </div>

        <div class="es-payment-cell">
          <strong>${row.subject || "—"}</strong>
          <small>${row.error_details || row.provider_reference || ""}</small>
        </div>
      `;

      list.appendChild(item);
    }
  );
}

async function loadCommunications() {
  statusBox.hidden = true;

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

    render(
      data.communications ||
      []
    );
  } catch (error) {
    statusBox.hidden = false;
    statusBox.className =
      "es-status error";
    statusBox.textContent =
      error.message ||
      "Unable to load communications.";
  }
}

refreshButton
  ?.addEventListener(
    "click",
    loadCommunications
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
        "Checking for due reminders…";

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
          `Reminder check complete. Sent ${data.sent || 0}; failed ${data.failed || 0}.`;

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
