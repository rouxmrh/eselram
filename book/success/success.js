const params = new URLSearchParams(location.search);
const appointmentId = params.get("appointment_id") || "";
const sessionId = params.get("session_id") || "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PUBLIC_CHECKOUT_KEY = "eselram_public_checkout_pending";
sessionStorage.removeItem(PUBLIC_CHECKOUT_KEY);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value || "";
  }
}

async function checkStatus() {
  if (!appointmentId || !sessionId) {
    throw new Error("The booking confirmation link is incomplete.");
  }

  let lastData = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(
      `/api/public-booking/status?appointment_id=${encodeURIComponent(appointmentId)}&session_id=${encodeURIComponent(sessionId)}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to confirm the booking.");
    }

    lastData = data;

    if (data.confirmed) {
      return data;
    }

    if (data.payment?.status === "failed") {
      throw new Error("The payment did not complete. Please return to the booking page and try again.");
    }

    await sleep(1200);
  }

  return lastData;
}

async function init() {
  const title = document.querySelector("#successTitle");
  const text = document.querySelector("#successText");
  const summary = document.querySelector("#successSummary");
  const error = document.querySelector("#successError");

  try {
    const data = await checkStatus();

    if (!data?.confirmed) {
      title.textContent = "Payment received — confirmation is still processing";
      text.textContent = "Stripe has returned you to the booking system, but the secure payment confirmation is taking a little longer than usual. Your booking reference has been saved.";
      return;
    }

    title.textContent = "Your appointment is confirmed";
    text.textContent = "Thank you. Your secure payment has been received and your appointment is now booked.";
    summary.hidden = false;
    summary.innerHTML = `
      <div class="review-item"><small>Service</small><strong>${escapeHtml(data.booking.service_name)}</strong></div>
      <div class="review-item"><small>Date & time</small><strong>${escapeHtml(formatDateTime(data.booking.start_at))}</strong></div>
      <div class="review-item"><small>Payment</small><strong>${escapeHtml(data.payment.payment_type === "deposit" ? "Deposit paid" : "Paid in full")}</strong></div>
      <div class="review-item"><small>Booking status</small><strong>Confirmed</strong></div>
    `;

    const requirements = [];
    if (Number(data.booking.requires_consultation || 0) === 1) requirements.push("A consultation is required before treatment.");
    if (Number(data.booking.requires_patch_test || 0) === 1) requirements.push("A patch test is required before treatment.");
    if (requirements.length) {
      text.textContent += ` ${requirements.join(" ")}`;
    }
  } catch (err) {
    document.querySelector("#successMark").textContent = "!";
    title.textContent = "We couldn't confirm the booking yet";
    text.textContent = "Please don't make another payment from this page.";
    error.hidden = false;
    error.textContent = err.message || "Unable to confirm the booking.";
  }
}

document.addEventListener("DOMContentLoaded", init);
