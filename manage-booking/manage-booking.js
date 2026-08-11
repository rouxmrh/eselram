const params = new URLSearchParams(location.search);
const token = String(params.get("token") || "").trim();
const state = { data: null };

const $ = selector => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(minor, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: String(currency || "GBP").toUpperCase()
    }).format(Number(minor || 0) / 100);
  } catch {
    return `£${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}

function formatDateTime(value) {
  if (!value) return "—";

  const local = String(value).replace(" ", "T");
  const [datePart, timePart = ""] = local.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  try {
    const synthetic = new Date(
      Date.UTC(year, month - 1, day, hour || 0, minute || 0)
    );

    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC"
    }).format(synthetic);
  } catch {
    return value;
  }
}

function showError(message) {
  const box = $("#manageError");
  box.hidden = false;
  box.textContent = message;
}

function showNotice(message) {
  const box = $("#manageNotice");
  box.hidden = false;
  box.textContent = message;
}

function clearMessages() {
  $("#manageError").hidden = true;
  $("#manageNotice").hidden = true;
}

function renderForms(forms) {
  const section = $("#manageFormsSection");
  const list = $("#manageFormsList");

  if (!forms.length) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }

  section.hidden = false;

  list.innerHTML = forms.map(form => `
    <div class="review-card" style="margin-bottom:10px;">
      <div class="review-item">
        <small>Form</small>
        <strong>${escapeHtml(form.name)}</strong>
      </div>

      <div class="review-item">
        <small>Status</small>
        <strong>${form.status === "submitted" ? "Completed" : "Action required"}</strong>
      </div>

      ${
        form.url
          ? `
            <div class="review-item">
              <small>Action</small>
              <strong><a href="${escapeHtml(form.url)}">Complete form</a></strong>
            </div>
          `
          : ""
      }
    </div>
  `).join("");
}

function render() {
  const data = state.data;
  const booking = data.booking;
  const payment = data.payment;

  document.title = `Manage ${booking.service_name} booking`;

  $("#manageBusinessName").textContent =
    data.business.name || "Your appointment";

  if (data.business.branding?.logo_data_url) {
    $("#manageLogo").src = data.business.branding.logo_data_url;
    $("#manageLogo").hidden = false;
  }

  const statusLabel =
    booking.status === "cancelled"
      ? "Cancelled"
      : booking.status === "completed"
        ? "Completed"
        : booking.status === "confirmed"
          ? "Confirmed"
          : booking.status;

  $("#manageTitle").textContent =
    booking.status === "cancelled"
      ? "This appointment is cancelled"
      : booking.status === "completed"
        ? "This appointment is complete"
        : "Your appointment";

  $("#manageSummary").hidden = false;
  $("#manageSummary").innerHTML = `
    <div class="review-item"><small>Service</small><strong>${escapeHtml(booking.service_name)}</strong></div>
    <div class="review-item"><small>Date & time</small><strong>${escapeHtml(formatDateTime(booking.start_at))}</strong></div>
    <div class="review-item"><small>Status</small><strong>${escapeHtml(statusLabel)}</strong></div>
    <div class="review-item"><small>Booking reference</small><strong>${escapeHtml(booking.id)}</strong></div>
  `;

  $("#managePaymentSection").hidden = false;
  $("#managePaymentSummary").innerHTML = `
    <div class="review-item"><small>Appointment value</small><strong>${escapeHtml(money(booking.price_minor, payment.currency))}</strong></div>
    <div class="review-item"><small>Paid</small><strong>${escapeHtml(money(payment.net_paid_minor, payment.currency))}</strong></div>
    <div class="review-item"><small>Outstanding</small><strong>${escapeHtml(money(payment.outstanding_minor, payment.currency))}</strong></div>
    <div class="review-item"><small>Refunded</small><strong>${escapeHtml(money(payment.refunded_minor, payment.currency))}</strong></div>
  `;

  renderForms(data.forms || []);

  const canChange =
    data.permissions?.can_reschedule ||
    data.permissions?.can_cancel;

  $("#manageActions").hidden = !canChange;
  $("#showRescheduleButton").hidden =
    !data.permissions?.can_reschedule;
  $("#cancelBookingButton").hidden =
    !data.permissions?.can_cancel;

  if (booking.status === "confirmed") {
    const requirements = [];

    if (Number(booking.requires_consultation || 0) === 1) {
      requirements.push("A consultation is required before treatment.");
    }

    if (Number(booking.requires_patch_test || 0) === 1) {
      requirements.push("A patch test is required before treatment.");
    }

    if (requirements.length) {
      showNotice(requirements.join(" "));
    }
  }
}

async function loadBooking() {
  if (!token) {
    showError("This manage-booking link is incomplete.");
    return;
  }

  try {
    const response = await fetch(
      `/api/manage-booking?token=${encodeURIComponent(token)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load this booking.");
    }

    state.data = data;
    render();
  } catch (error) {
    showError(error.message || "Unable to load this booking.");
  }
}

$("#showRescheduleButton")?.addEventListener("click", () => {
  clearMessages();
  $("#reschedulePanel").hidden = false;
  $("#manageDate").focus();
});

$("#closeRescheduleButton")?.addEventListener("click", () => {
  $("#reschedulePanel").hidden = true;
  $("#manageSlots").innerHTML = "";
  $("#manageSlotStatus").textContent =
    "Choose a date to see available times.";
});

$("#manageDate")?.addEventListener("change", async () => {
  clearMessages();

  const date = $("#manageDate").value;
  const status = $("#manageSlotStatus");
  const slots = $("#manageSlots");

  slots.innerHTML = "";

  if (!date) {
    status.textContent = "Choose a date to see available times.";
    return;
  }

  status.textContent = "Checking availability…";

  try {
    const response = await fetch(
      `/api/manage-booking/availability?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load available times.");
    }

    if (!(data.slots || []).length) {
      status.textContent =
        data.reason || "No times are available on this date.";
      return;
    }

    status.textContent = `${data.slots.length} times available`;

    data.slots.forEach(time => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";
      button.textContent = time;

      button.addEventListener("click", async () => {
        await reschedule(date, time, button);
      });

      slots.appendChild(button);
    });
  } catch (error) {
    status.textContent =
      error.message || "Unable to load available times.";
  }
});

async function reschedule(date, time, button) {
  if (!confirm(`Move this appointment to ${date} at ${time}?`)) {
    return;
  }

  button.disabled = true;
  clearMessages();

  try {
    const response = await fetch("/api/manage-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        token,
        action: "reschedule",
        date,
        time
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Unable to reschedule this appointment."
      );
    }

    $("#reschedulePanel").hidden = true;
    showNotice(
      "Your appointment has been rescheduled. A confirmation email has been sent."
    );

    await loadBooking();
  } catch (error) {
    showError(
      error.message || "Unable to reschedule this appointment."
    );
    button.disabled = false;
  }
}

$("#cancelBookingButton")?.addEventListener("click", async () => {
  if (
    !confirm(
      "Cancel this appointment? This does not automatically refund any payment."
    )
  ) {
    return;
  }

  const button = $("#cancelBookingButton");
  button.disabled = true;
  clearMessages();

  try {
    const response = await fetch("/api/manage-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        token,
        action: "cancel",
        reason: "Cancelled by customer through self-service"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Unable to cancel this appointment."
      );
    }

    showNotice(
      "Your appointment has been cancelled. Any payment or refund is handled separately."
    );

    await loadBooking();
  } catch (error) {
    showError(error.message || "Unable to cancel this appointment.");
    button.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", loadBooking);
