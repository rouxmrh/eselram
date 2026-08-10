const state = {
  config: null,
  service: null,
  date: "",
  time: "",
  details: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function money(minor, currency = "GBP", locale = "en-GB") {
  return new Intl.NumberFormat(locale || "en-GB", {
    style: "currency",
    currency: currency || "GBP"
  }).format(Number(minor || 0) / 100);
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  try {
    return new Intl.DateTimeFormat(state.config?.business?.locale || "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(`${dateValue}T12:00:00`));
  } catch {
    return dateValue;
  }
}

function paymentText(service) {
  const currency = state.config?.business?.currency || "GBP";
  const locale = state.config?.business?.locale || "en-GB";

  if (service.payment_timing === "free" || Number(service.price_minor || 0) <= 0) {
    return "Free";
  }
  if (service.payment_timing === "online_deposit") {
    return `${money(service.deposit_minor, currency, locale)} deposit online`;
  }
  if (service.payment_timing === "online_full") {
    return `${money(service.price_minor, currency, locale)} online`;
  }
  return `${money(service.price_minor, currency, locale)} · pay at appointment`;
}

function showError(message) {
  const el = $("#pageError");
  el.textContent = message;
  el.hidden = !message;
  if (message) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function setStep(step) {
  showError("");
  $$(".step").forEach((section) => {
    section.classList.toggle("active", Number(section.dataset.step) === Number(step));
  });

  $$(".progress-step").forEach((progress) => {
    progress.classList.toggle(
      "active",
      Number(progress.dataset.progress) <= Math.min(Number(step), 4)
    );
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyBranding(config) {
  const b = config.branding || {};
  const root = document.documentElement;
  root.style.setProperty("--primary", b.primary_colour || "#365c50");
  root.style.setProperty("--accent", b.accent_colour || "#6f8079");
  root.style.setProperty("--bg", b.background_colour || "#f5f4ef");
  root.style.setProperty("--surface", b.surface_colour || "#ffffff");
  root.style.setProperty("--text", b.text_colour || "#18221f");

  document.title = `Book · ${config.business.name}`;
  $("#businessName").textContent =
    Number(b.show_business_name ?? 1) === 1 ? config.business.name : "Book an appointment";

  const logo = $("#businessLogo");
  if (b.logo_data_url) {
    logo.src = b.logo_data_url;
    logo.alt = `${config.business.name} logo`;
    logo.hidden = false;
  }

  if (Number(b.show_contact_details ?? 1) === 1) {
    $("#businessContact").textContent = [
      config.business.email,
      config.business.phone
    ].filter(Boolean).join(" · ");
  }

  $("#footerText").textContent = b.footer_text || "";
}

function renderServices() {
  const container = $("#services");
  container.innerHTML = "";

  const services = state.config?.services || [];
  if (!services.length) {
    container.innerHTML = `<div class="message">No online services are available yet.</div>`;
    return;
  }

  services.forEach((service) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-card";
    button.disabled = !service.online_booking_available;

    const requirements = [];
    if (Number(service.requires_consultation || 0) === 1) requirements.push("Consultation required");
    if (Number(service.requires_patch_test || 0) === 1) requirements.push("Patch test required");

    button.innerHTML = `
      <h3>${escapeHtml(service.name)}</h3>
      <p>${escapeHtml(service.description || "")}</p>
      <div class="service-meta">
        <span>${Number(service.duration_minutes)} min</span>
        <span>${escapeHtml(paymentText(service))}</span>
        ${requirements.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      ${service.unavailable_reason ? `<div class="service-unavailable">${escapeHtml(service.unavailable_reason)}</div>` : ""}
    `;

    button.addEventListener("click", () => {
      state.service = service;
      state.date = "";
      state.time = "";
      $("#selectedServiceText").textContent = `${service.name} · ${Number(service.duration_minutes)} min · ${paymentText(service)}`;
      $("#bookingDate").value = "";
      $("#slots").innerHTML = "";
      $("#slotStatus").textContent = "Choose a date to see available times.";
      setStep(2);
    });

    container.appendChild(button);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadSlots() {
  const date = $("#bookingDate").value;
  state.date = date;
  state.time = "";
  const slotsEl = $("#slots");
  const statusEl = $("#slotStatus");
  slotsEl.innerHTML = "";

  if (!date || !state.service) {
    statusEl.textContent = "Choose a date to see available times.";
    return;
  }

  statusEl.textContent = "Checking availability…";

  try {
    const response = await fetch(
      `/api/public-booking/availability?service_id=${encodeURIComponent(state.service.id)}&date=${encodeURIComponent(date)}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load available times.");
    }

    if (!(data.slots || []).length) {
      statusEl.textContent = "No times are available on this date. Try another day.";
      return;
    }

    statusEl.textContent = `${data.slots.length} time${data.slots.length === 1 ? "" : "s"} available`;

    data.slots.forEach((time) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot";
      button.textContent = time;
      button.addEventListener("click", () => {
        state.time = time;
        $("#selectedTimeText").textContent = `${state.service.name} · ${formatDate(state.date)} at ${state.time}`;
        setStep(3);
      });
      slotsEl.appendChild(button);
    });
  } catch (error) {
    statusEl.textContent = "";
    showError(error.message || "Unable to load available times.");
  }
}

function renderReview() {
  const currency = state.config.business.currency || "GBP";
  const locale = state.config.business.locale || "en-GB";
  const service = state.service;

  $("#reviewCard").innerHTML = `
    <div class="review-item"><small>Service</small><strong>${escapeHtml(service.name)}</strong></div>
    <div class="review-item"><small>Date & time</small><strong>${escapeHtml(formatDate(state.date))} · ${escapeHtml(state.time)}</strong></div>
    <div class="review-item"><small>Name</small><strong>${escapeHtml(`${state.details.first_name} ${state.details.last_name}`)}</strong></div>
    <div class="review-item"><small>Email</small><strong>${escapeHtml(state.details.email)}</strong></div>
    <div class="review-item"><small>Price</small><strong>${escapeHtml(money(service.price_minor, currency, locale))}</strong></div>
    <div class="review-item"><small>Payment</small><strong>${escapeHtml(paymentText(service))}</strong></div>
  `;

  const notices = [];
  if (Number(service.requires_consultation || 0) === 1) {
    notices.push("This service requires a consultation. The business will confirm the consultation requirements with you.");
  }
  if (Number(service.requires_patch_test || 0) === 1) {
    notices.push("This service requires a patch test before treatment. The business will confirm the patch-test requirements with you.");
  }

  const requirements = $("#requirementsNotice");
  requirements.hidden = notices.length === 0;
  requirements.textContent = notices.join(" ");
  $("#confirmDetails").checked = false;
}

async function confirmBooking() {
  if (!$("#confirmDetails").checked) {
    showError("Please confirm that the booking details are correct.");
    return;
  }

  const button = $("#confirmBooking");
  button.disabled = true;
  button.textContent = "Confirming…";

  try {
    const response = await fetch("/api/public-booking/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        service_id: state.service.id,
        date: state.date,
        time: state.time,
        ...state.details
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to complete the booking.");
    }

    if (data.ignored) {
      setStep(5);
      return;
    }

    if (data.payment_required && data.checkout?.url) {
      window.location.assign(data.checkout.url);
      return;
    }

    renderFinal(data.booking);
    setStep(5);
  } catch (error) {
    showError(error.message || "Unable to complete the booking.");
    button.disabled = false;
    button.textContent = "Confirm booking";
  }
}

function renderFinal(booking) {
  const serviceName = booking?.service_name || state.service?.name || "Appointment";
  const startAt = booking?.start_at || `${state.date}T${state.time}:00`;
  const [date, time] = String(startAt).split("T");

  $("#finalSummary").innerHTML = `
    <div class="review-item"><small>Service</small><strong>${escapeHtml(serviceName)}</strong></div>
    <div class="review-item"><small>Date & time</small><strong>${escapeHtml(formatDate(date))} · ${escapeHtml((time || "").slice(0,5))}</strong></div>
  `;

  const notices = [];
  if (Number(booking?.requires_consultation || state.service?.requires_consultation || 0) === 1) {
    notices.push("A consultation is required before treatment.");
  }
  if (Number(booking?.requires_patch_test || state.service?.requires_patch_test || 0) === 1) {
    notices.push("A patch test is required before treatment.");
  }
  $("#finalRequirements").textContent = notices.join(" ");
}

async function init() {
  try {
    const response = await fetch("/api/public-booking/config", {
      headers: { Accept: "application/json" }
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load the booking page.");
    }

    state.config = data;
    applyBranding(data);
    renderServices();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    $("#bookingDate").min = `${yyyy}-${mm}-${dd}`;

    const max = new Date(today);
    max.setDate(max.getDate() + 90);
    $("#bookingDate").max = `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,"0")}-${String(max.getDate()).padStart(2,"0")}`;
  } catch (error) {
    showError(error.message || "Unable to load the booking page.");
  }
}

$("#bookingDate").addEventListener("change", loadSlots);

$("#detailsForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const firstName = $("#firstName").value.trim();
  const lastName = $("#lastName").value.trim();
  const email = $("#email").value.trim();

  if (!firstName || !lastName || !email || !$("#email").checkValidity()) {
    showError("Please enter your first name, last name and a valid email address.");
    return;
  }

  state.details = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: $("#phone").value.trim(),
    notes: $("#notes").value.trim(),
    marketing_consent: $("#marketingConsent").checked,
    company_website: $("#companyWebsite").value
  };

  renderReview();
  setStep(4);
});

$("#confirmBooking").addEventListener("click", confirmBooking);

$$('[data-back]').forEach((button) => {
  button.addEventListener("click", () => setStep(Number(button.dataset.back)));
});

document.addEventListener("DOMContentLoaded", init);
