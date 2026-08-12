const state = {
  config: null,
  service: null,
  date: "",
  time: "",
  details: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const PUBLIC_CHECKOUT_KEY = "eselram_public_checkout_pending";

function pendingFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const appointmentId =
    params.get("pending_appointment_id") || "";

  const paymentId =
    params.get("pending_payment_id") || "";

  if (!appointmentId || !paymentId) {
    return null;
  }

  return {
    appointment_id: appointmentId,
    payment_id: paymentId,
    session_id:
      params.get("pending_session_id") || "",
    service_id:
      params.get("pending_service_id") || "",
    date:
      params.get("pending_date") || "",
    time:
      params.get("pending_time") || ""
  };
}

function savePendingCheckout(checkout, booking) {
  const pending = {
    appointment_id: booking?.id || "",
    payment_id: checkout?.payment_id || "",
    session_id: checkout?.session_id || "",
    service_id: state.service?.id || "",
    date: state.date || "",
    time: state.time || "",
    created_at: Date.now()
  };

  sessionStorage.setItem(
    PUBLIC_CHECKOUT_KEY,
    JSON.stringify(pending)
  );

  localStorage.setItem(
    PUBLIC_CHECKOUT_KEY,
    JSON.stringify(pending)
  );

  // Replace the current Eselram history entry BEFORE leaving for Stripe.
  // Browser Back will therefore return to a URL that contains everything
  // needed to release the provisional appointment.
  const url = new URL(window.location.href);
  url.searchParams.set(
    "pending_appointment_id",
    pending.appointment_id
  );
  url.searchParams.set(
    "pending_payment_id",
    pending.payment_id
  );
  url.searchParams.set(
    "pending_session_id",
    pending.session_id
  );
  url.searchParams.set(
    "pending_service_id",
    pending.service_id
  );
  url.searchParams.set(
    "pending_date",
    pending.date
  );
  url.searchParams.set(
    "pending_time",
    pending.time
  );

  history.replaceState(
    history.state,
    "",
    url.toString()
  );
}

function getPendingCheckout() {
  const fromUrl = pendingFromUrl();
  if (fromUrl) {
    return fromUrl;
  }

  for (const store of [
    sessionStorage,
    localStorage
  ]) {
    try {
      const value =
        JSON.parse(
          store.getItem(
            PUBLIC_CHECKOUT_KEY
          ) || "null"
        );

      if (
        value?.appointment_id &&
        value?.payment_id
      ) {
        return value;
      }
    } catch {
      // Ignore malformed cached state.
    }
  }

  return null;
}

function clearPendingCheckout() {
  sessionStorage.removeItem(
    PUBLIC_CHECKOUT_KEY
  );

  localStorage.removeItem(
    PUBLIC_CHECKOUT_KEY
  );

  const url = new URL(window.location.href);

  [
    "pending_appointment_id",
    "pending_payment_id",
    "pending_session_id",
    "pending_service_id",
    "pending_date",
    "pending_time"
  ].forEach(
    (key) =>
      url.searchParams.delete(key)
  );

  history.replaceState(
    history.state,
    "",
    `${url.pathname}${
      url.search
    }${url.hash}`
  );
}

function resetConfirmButton() {
  const button = $("#confirmBooking");
  if (!button) return;

  button.disabled = false;
  button.textContent =
    "Confirm booking";
}

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

function consultationPaymentText(service) {
  const currency =
    state.config?.business?.currency ||
    "GBP";

  const locale =
    state.config?.business?.locale ||
    "en-GB";

  const price =
    Number(
      service.consultation_price_minor ||
      0
    );

  const timing =
    service.consultation_payment_timing ||
    "free";

  if (
    timing === "free" ||
    price <= 0
  ) {
    return "Free consultation";
  }

  if (
    timing === "online_full"
  ) {
    return `${money(
      price,
      currency,
      locale
    )} consultation fee online`;
  }

  return `${money(
    price,
    currency,
    locale
  )} · pay at consultation`;
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
    const bookingEnabled =
      state.config
        ?.booking_rules
        ?.enabled !==
      false;

    container.innerHTML = `
      <div class="message">
        ${
          bookingEnabled
            ? "No online services are available yet."
            : "Online booking is currently unavailable."
        }
      </div>
    `;

    return;
  }

  services.forEach((service) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-card";
    button.dataset.serviceId =
      service.id;
    button.disabled = !service.online_booking_available;

    const requirements = [];
    if (Number(service.requires_consultation || 0) === 1) {
      requirements.push("New clients book consultation first");
    }
    if (Number(service.requires_patch_test || 0) === 1) requirements.push("Patch test required");

    button.innerHTML = `
      <h3>${escapeHtml(service.name)}</h3>
      <p>${escapeHtml(service.description || "")}</p>
      <div class="service-meta">
        <span>${Number(service.duration_minutes)} min treatment</span>
        <span>${escapeHtml(paymentText(service))}</span>
        ${
          Number(
            service.requires_consultation ||
            0
          ) === 1
            ? `<span>${escapeHtml(
                `${Number(
                  service.consultation_duration_minutes ||
                  30
                )} min consultation · ${consultationPaymentText(
                  service
                )}`
              )}</span>`
            : ""
        }
        ${requirements.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      ${service.unavailable_reason ? `<div class="service-unavailable">${escapeHtml(service.unavailable_reason)}</div>` : ""}
    `;

    button.addEventListener("click", () => {
      state.service = service;
      state.date = "";
      state.time = "";
      $("#selectedServiceText").textContent =
        Number(
          service.requires_consultation ||
          0
        ) === 1
          ? `${service.name} · new clients are booked into a consultation first`
          : `${service.name} · ${Number(service.duration_minutes)} min · ${paymentText(service)}`;
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
      statusEl.textContent =
        data.reason ||
        "No times are available on this date. Try another day.";
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
    ${
      Number(
        service.requires_consultation ||
        0
      ) === 1
        ? `
          <div class="review-item">
            <small>New clients</small>
            <strong>
              Consultation · ${escapeHtml(
                consultationPaymentText(
                  service
                )
              )}
            </strong>
          </div>
          <div class="review-item">
            <small>Existing eligible clients</small>
            <strong>
              Treatment · ${escapeHtml(
                paymentText(
                  service
                )
              )}
            </strong>
          </div>
        `
        : `
          <div class="review-item"><small>Price</small><strong>${escapeHtml(money(service.price_minor, currency, locale))}</strong></div>
          <div class="review-item"><small>Payment</small><strong>${escapeHtml(paymentText(service))}</strong></div>
        `
    }
  `;

  const notices = [];
  if (Number(service.requires_consultation || 0) === 1) {
    notices.push("If this is your first booking for this service, Eselram will book this date and time as your consultation rather than a treatment session. Treatment and package purchase become available after the consultation is completed.");
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
      throw new Error("We couldn't complete the booking. Please try again.");
    }

    if (data.payment_required && data.checkout?.url) {
      savePendingCheckout(
        data.checkout,
        data.booking
      );

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
  const serviceName =
    booking?.booking_label ||
    booking?.service_name ||
    state.service?.name ||
    "Appointment";
  const startAt = booking?.start_at || `${state.date}T${state.time}:00`;
  const [date, time] = String(startAt).split("T");

  $("#finalSummary").innerHTML = `
    <div class="review-item"><small>Service</small><strong>${escapeHtml(serviceName)}</strong></div>
    <div class="review-item"><small>Date & time</small><strong>${escapeHtml(formatDate(date))} · ${escapeHtml((time || "").slice(0,5))}</strong></div>
  `;

  const notices = [];
  if (Number(booking?.requires_consultation || state.service?.requires_consultation || 0) === 1) {
    notices.push(
      booking?.booking_kind ===
        "consultation"
        ? "This booking is your consultation. Treatment can be booked after the consultation is completed."
        : "Your consultation requirement has been met."
    );
  }
  if (Number(booking?.requires_patch_test || state.service?.requires_patch_test || 0) === 1) {
    notices.push("A patch test is required before treatment.");
  }
  $("#finalRequirements").textContent = notices.join(" ");
}

async function releaseReturnedCheckout() {
  const pending = getPendingCheckout();

  if (
    !pending?.appointment_id ||
    !pending?.payment_id
  ) {
    resetConfirmButton();
    return;
  }

  try {
    const response = await fetch(
      "/api/public-booking/cancel",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          appointment_id:
            pending.appointment_id,
          payment_id:
            pending.payment_id
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Unable to release the provisional booking."
      );
    }

    clearPendingCheckout();
    resetConfirmButton();

    if (data.paid) {
      if (pending.session_id) {
        window.location.replace(
          `/book/success/?appointment_id=${encodeURIComponent(
            pending.appointment_id
          )}&session_id=${encodeURIComponent(
            pending.session_id
          )}`
        );
        return;
      }

      showError(
        "Your payment was received. Please check your booking confirmation."
      );
      return;
    }

    if (state.service) {
      state.time = "";
      setStep(2);

      if (
        pending.date &&
        $("#bookingDate")
      ) {
        state.date = pending.date;
        $("#bookingDate").value =
          pending.date;

        await loadSlots();
      }
    } else {
      setStep(1);
    }

    showError(
      "Payment was not completed, so the provisional appointment has been released. You can choose a time and try again."
    );
  } catch (error) {
    resetConfirmButton();

    showError(
      error.message ||
      "We couldn't release the provisional booking. Please refresh the page."
    );
  }
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

    const requestedServiceId =
      new URLSearchParams(
        location.search
      ).get(
        "service_id"
      );

    if (requestedServiceId) {
      document
        .querySelector(
          `[data-service-id="${CSS.escape(
            requestedServiceId
          )}"]`
        )
        ?.click();
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    $("#bookingDate").min = `${yyyy}-${mm}-${dd}`;

    const maxAdvanceDays =
      Math.max(
        1,
        Number(
          data.booking_rules
            ?.max_advance_days ||
          90
        )
      );

    const max =
      new Date(today);

    max.setDate(
      max.getDate() +
      maxAdvanceDays
    );

    $("#bookingDate").max =
      `${max.getFullYear()}-${String(
        max.getMonth() + 1
      ).padStart(2, "0")}-${String(
        max.getDate()
      ).padStart(2, "0")}`;

    // A fresh load of /book/ in this tab after leaving Stripe means the
    // customer has returned without completing the hosted Checkout.
    // pageshow handles BFCache/browser-Back returns; this handles reloads.
    if (
      getPendingCheckout() &&
      performance.getEntriesByType("navigation")[0]?.type === "reload"
    ) {
      await releaseReturnedCheckout();
    }
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
    marketing_consent: $("#marketingConsent").checked
  };

  renderReview();
  setStep(4);
});

$("#confirmBooking").addEventListener("click", confirmBooking);

$$('[data-back]').forEach((button) => {
  button.addEventListener("click", () => setStep(Number(button.dataset.back)));
});

let releaseInProgress = false;

async function cleanupPendingCheckoutOnFreshBookingPage() {
  const pending = getPendingCheckout();

  if (
    releaseInProgress ||
    !pending?.appointment_id ||
    !pending?.payment_id
  ) {
    resetConfirmButton();
    return;
  }

  releaseInProgress = true;

  try {
    await releaseReturnedCheckout();
  } finally {
    releaseInProgress = false;
  }
}

// Stripe remains in the SAME tab.
// Successful payment is redirected automatically by Stripe to /book/success/.
// We deliberately do not depend on browser Back/history events for correctness.
// If an unpaid customer later returns to /book/, this fresh page load cleans up
// their provisional Checkout. The backend expiry remains the final safety net.
document.addEventListener(
  "DOMContentLoaded",
  async () => {
    await init();
    await cleanupPendingCheckoutOnFreshBookingPage();
  }
);
