const state = {
  config: null,
  service: null,
  bookingIntent: null,
  paymentPreview: null,
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

function bookingDepositText(service) {
  const currency =
    state.config?.business?.currency || "GBP";

  const locale =
    state.config?.business?.locale || "en-GB";

  if (
    service.payment_timing !== "online_deposit"
  ) {
    return paymentText(service);
  }

  return `${money(
    service.deposit_minor,
    currency,
    locale
  )} booking deposit online`;
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

function serviceDisplayName(value) {
  return String(value || "");
}

function selectServiceRoute(service, bookingIntent) {
  state.service = service;
  state.bookingIntent = bookingIntent || "service";
  state.date = "";
  state.time = "";

  const isConsultation =
    state.bookingIntent === "consultation";

  $("#selectedServiceText").textContent =
    isConsultation
      ? `Consultation · ${serviceDisplayName(service.name)} · ${Number(
          service.consultation_duration_minutes || 30
        )} min · ${consultationPaymentText(service)}`
      : `${serviceDisplayName(service.name)} treatment · ${Number(
          service.duration_minutes || 0
        )} min · ${paymentText(service)}`;

  $("#bookingDate").value = "";
  $("#slots").innerHTML = "";
  $("#slotStatus").textContent =
    "Choose a date to see available times.";
  setStep(2);
}

function publicBookingGroup(service) {
  return String(service.booking_group || service.name || "Service").trim() || "Service";
}

function groupedPublicServices() {
  const groups = new Map();
  for (const service of state.config?.services || []) {
    const groupName = publicBookingGroup(service);
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(service);
  }
  return [...groups.entries()].map(([name, services]) => ({ name, services }));
}

function renderSelectedBookingGroup(groupName) {
  const container = $("#services");
  const groups = groupedPublicServices();
  const group = groups.find(item => item.name === groupName) || groups[0];
  if (!group) return;

  container.querySelectorAll("[data-booking-group]").forEach(button => {
    button.classList.toggle("active", button.dataset.bookingGroup === group.name);
  });

  const panel = container.querySelector("#bookingGroupPanel");
  if (!panel) return;

  const consultationService =
    group.services.find(
      service => String(service.service_type || "standard") === "consultation"
    ) || null;

  const treatmentServices = group.services.filter(
    service => String(service.service_type || "standard") !== "consultation"
  );

  if (consultationService) {
    const linkedTreatments = treatmentServices.filter(
      service => service.consultation_service_id === consultationService.id
    );

    const clientBookable = linkedTreatments.filter(
      service => String(service.post_consultation_booking || "client_can_book") === "client_can_book"
    );

    const practitionerManaged = linkedTreatments.some(
      service => String(service.post_consultation_booking || "") === "practitioner_managed"
    );

    let selectedService = clientBookable[0] || null;
    const patchRequired = linkedTreatments.some(
      service => Number(service.requires_patch_test || 0) === 1
    );

    panel.innerHTML = `
      <h3>${escapeHtml(group.name)}</h3>
      <p class="booking-category-copy">
        New clients start with a consultation. The consultation is
        ${Number(consultationService.duration_minutes || 0)} minutes and
        ${escapeHtml(paymentText(consultationService))}.
        ${patchRequired ? "A patch test is required before treatment." : ""}
        ${
          practitionerManaged && !clientBookable.length
            ? "After the consultation, the practitioner will agree the correct treatment or package and manage the treatment bookings."
            : clientBookable.length
              ? "Existing clients who have completed the required consultation can book an eligible treatment online using the same customer details held by the business."
              : ""
        }
      </p>

      ${clientBookable.length ? `
        <div class="booking-service-pills">
          ${clientBookable.map(service => `
            <button
              class="booking-service-pill ${service.id === selectedService?.id ? "active" : ""}"
              type="button"
              data-existing-service="${escapeHtml(service.id)}"
            >
              ${escapeHtml(serviceDisplayName(service.name))}
            </button>
          `).join("")}
        </div>
        <div id="existingServiceSummary" class="booking-service-summary"></div>
      ` : ""}

      <div class="service-choice-actions">
        <button
          class="primary-button service-choice-button"
          type="button"
          id="bookStandaloneConsultation"
          ${consultationService.online_booking_available ? "" : "disabled"}
        >
          Book consultation
        </button>
        ${clientBookable.length ? `
          <button class="text-button service-choice-button" type="button" id="bookExistingTreatment">
            Existing client · Book treatment
          </button>
        ` : ""}
      </div>
    `;

    panel.querySelector("#bookStandaloneConsultation")?.addEventListener(
      "click",
      () => selectServiceRoute(consultationService, "service")
    );

    if (clientBookable.length) {
      const summary = panel.querySelector("#existingServiceSummary");
      function updateExistingService(service) {
        selectedService = service;
        panel.querySelectorAll("[data-existing-service]").forEach(button => {
          button.classList.toggle("active", button.dataset.existingService === service.id);
        });
        summary.innerHTML = `
          <strong>${escapeHtml(serviceDisplayName(service.name))}</strong>
          <span>${Number(service.duration_minutes || 0)} min · ${escapeHtml(bookingDepositText(service))}</span>
        `;
      }
      panel.querySelectorAll("[data-existing-service]").forEach(button => {
        button.addEventListener("click", () => {
          const service = clientBookable.find(item => item.id === button.dataset.existingService);
          if (service) updateExistingService(service);
        });
      });
      panel.querySelector("#bookExistingTreatment")?.addEventListener(
        "click",
        () => selectServiceRoute(selectedService, "service")
      );
      updateExistingService(selectedService);
    }
    return;
  }

  // Backward-compatible legacy consultation-first service.
  const legacyConsultation = treatmentServices.find(
    service => Number(service.requires_consultation || 0) === 1 && !service.consultation_service_id
  );

  if (legacyConsultation) {
    const clientBookable = treatmentServices.filter(
      service =>
        Number(service.requires_consultation || 0) === 1 &&
        !service.consultation_service_id &&
        String(service.post_consultation_booking || "client_can_book") === "client_can_book"
    );
    const selectedService = clientBookable[0] || legacyConsultation;
    panel.innerHTML = `
      <h3>${escapeHtml(group.name)}</h3>
      <p class="booking-category-copy">
        New clients start with a consultation. The consultation is
        ${Number(legacyConsultation.consultation_duration_minutes || 30)} minutes and
        ${escapeHtml(consultationPaymentText(legacyConsultation))}.
      </p>
      <div class="service-choice-actions">
        <button class="primary-button service-choice-button" type="button" id="bookLegacyConsultation">Book consultation</button>
        ${clientBookable.length ? `<button class="text-button service-choice-button" type="button" id="bookLegacyTreatment">Existing client · Book treatment</button>` : ""}
      </div>
    `;
    panel.querySelector("#bookLegacyConsultation")?.addEventListener("click", () => selectServiceRoute(legacyConsultation, "consultation"));
    panel.querySelector("#bookLegacyTreatment")?.addEventListener("click", () => selectServiceRoute(selectedService, "service"));
    return;
  }

  let selectedService = treatmentServices[0];
  if (!selectedService) {
    panel.innerHTML = `<div class="message">No bookable services are available.</div>`;
    return;
  }

  panel.innerHTML = `
    <h3>${escapeHtml(group.name)}</h3>
    ${treatmentServices.length > 1 ? `
      <p class="booking-category-copy">Choose the service you would like to book.</p>
      <div class="booking-service-pills">
        ${treatmentServices.map(service => `
          <button class="booking-service-pill ${service.id === selectedService.id ? "active" : ""}" type="button" data-direct-service="${escapeHtml(service.id)}">
            ${escapeHtml(serviceDisplayName(service.name))}
          </button>
        `).join("")}
      </div>
    ` : ""}
    <div id="directServiceSummary" class="booking-service-summary"></div>
    <div class="service-choice-actions">
      <button id="bookSelectedService" class="primary-button service-choice-button" type="button">Book treatment</button>
    </div>
  `;

  const summary = panel.querySelector("#directServiceSummary");
  const bookButton = panel.querySelector("#bookSelectedService");

  function updateDirectService(service) {
    selectedService = service;
    panel.querySelectorAll("[data-direct-service]").forEach(button => {
      button.classList.toggle("active", button.dataset.directService === service.id);
    });
    summary.innerHTML = `
      <strong>${escapeHtml(serviceDisplayName(service.name))}</strong>
      <span>${Number(service.duration_minutes || 0)} min · ${escapeHtml(bookingDepositText(service))}</span>
      ${service.description ? `<span>${escapeHtml(service.description)}</span>` : ""}
    `;
    bookButton.disabled = !service.online_booking_available;
  }

  panel.querySelectorAll("[data-direct-service]").forEach(button => {
    button.addEventListener("click", () => {
      const service = treatmentServices.find(item => item.id === button.dataset.directService);
      if (service) updateDirectService(service);
    });
  });

  bookButton.addEventListener("click", () => selectServiceRoute(selectedService, "service"));
  updateDirectService(selectedService);
}

function renderServices() {
  const container = $("#services");
  const services = state.config?.services || [];
  $("#publicPackagesButton").hidden = !state.config?.has_public_packages;

  if (!services.length) {
    container.innerHTML = `<div class="message">No online services are available yet.</div>`;
    return;
  }

  const groups = groupedPublicServices();
  container.innerHTML = `
    <div class="booking-category-pills" role="tablist" aria-label="Treatments and services">
      ${groups.map((group, index) => `
        <button class="booking-category-pill ${index === 0 ? "active" : ""}" type="button" data-booking-group="${escapeHtml(group.name)}">
          ${escapeHtml(group.name)}
        </button>
      `).join("")}
    </div>
    <div id="bookingGroupPanel" class="booking-category-panel"></div>
  `;

  container.querySelectorAll("[data-booking-group]").forEach(button => {
    button.addEventListener("click", () => renderSelectedBookingGroup(button.dataset.bookingGroup));
  });
  renderSelectedBookingGroup(groups[0].name);
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
      `/api/public-booking/availability?service_id=${encodeURIComponent(
        state.service.id
      )}&date=${encodeURIComponent(
        date
      )}&booking_kind=${encodeURIComponent(
        state.bookingIntent || "service"
      )}`,
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
        $("#selectedTimeText").textContent =
          `${
            state.bookingIntent === "consultation"
              ? `Consultation · ${serviceDisplayName(state.service.name)}`
              : serviceDisplayName(state.service.name)
          } · ${formatDate(state.date)} at ${state.time}`;
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
    <div class="review-item"><small>Service</small><strong>${escapeHtml(serviceDisplayName(service.name))}</strong></div>
    <div class="review-item"><small>Date & time</small><strong>${escapeHtml(formatDate(state.date))} · ${escapeHtml(state.time)}</strong></div>
    <div class="review-item"><small>Name</small><strong>${escapeHtml(`${state.details.first_name} ${state.details.last_name}`)}</strong></div>
    <div class="review-item"><small>Email</small><strong>${escapeHtml(state.details.email)}</strong></div>
    ${
      state.bookingIntent === "consultation"
        ? `
          <div class="review-item">
            <small>Booking type</small>
            <strong>Consultation</strong>
          </div>
          <div class="review-item">
            <small>Payment</small>
            <strong>${escapeHtml(
              consultationPaymentText(service)
            )}</strong>
          </div>
        `
        : `
          <div class="review-item">
            <small>Booking type</small>
            <strong>Treatment</strong>
          </div>
          <div class="review-item"><small>Price</small><strong>${escapeHtml(money(service.price_minor, currency, locale))}</strong></div>
          ${
            Number(state.paymentPreview?.consultation_credit_minor || 0) > 0
              ? `
                <div class="review-item">
                  <small>Consultation credit</small>
                  <strong>${escapeHtml(
                    money(
                      state.paymentPreview.consultation_credit_minor,
                      currency,
                      locale
                    )
                  )}</strong>
                </div>
                <div class="review-item">
                  <small>Due today</small>
                  <strong>${escapeHtml(
                    money(
                      state.paymentPreview.due_today_minor || 0,
                      currency,
                      locale
                    )
                  )}</strong>
                </div>
                <div class="review-item">
                  <small>Remaining balance</small>
                  <strong>${escapeHtml(
                    money(
                      state.paymentPreview.remaining_minor || 0,
                      currency,
                      locale
                    )
                  )}</strong>
                </div>
              `
              : `
                <div class="review-item">
                  <small>Payment</small>
                  <strong>${escapeHtml(
                    bookingDepositText(service)
                  )}</strong>
                </div>
              `
          }
        `
    }
  `;

  const notices = [];
  if (Number(service.requires_consultation || 0) === 1) {
    notices.push(
      state.bookingIntent === "consultation"
        ? "You are booking a consultation. Once it is completed, the consultation payment is credited toward your next treatment or package for this service."
        : (
            Number(state.paymentPreview?.consultation_credit_minor || 0) > 0 &&
            Number(state.paymentPreview?.due_today_minor || 0) === 0
              ? `${money(
                  state.paymentPreview.consultation_credit_minor,
                  currency,
                  locale
                )} consultation credit will be applied. Nothing is due today.`
              : `${
                  service.payment_timing === "online_deposit"
                    ? `${money(
                        service.deposit_minor,
                        currency,
                        locale
                      )} booking deposit is required to secure your appointment. The deposit is deducted from your treatment total. If you cancel less than 24 hours before your appointment, the deposit is non-refundable. `
                    : ""
                }Eselram will verify your first name, last name, email address and phone number against your existing customer record and confirm that you have completed the required consultation for this treatment.`
          )
    );
  }
  if (Number(service.requires_patch_test || 0) === 1) {
    notices.push("A patch test is required before the first treatment. The business will confirm the patch-test requirements with you.");
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
        booking_intent: state.bookingIntent || "service",
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
    serviceDisplayName(state.service?.name) ||
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
      const requestedService =
        (data.services || []).find(
          service => service.id === requestedServiceId
        );

      if (requestedService) {
        selectServiceRoute(
          requestedService,
          Number(requestedService.requires_consultation || 0) === 1
            ? "consultation"
            : "service"
        );
      }
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

$("#detailsForm").addEventListener("submit", async (event) => {
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

  state.paymentPreview = null;

  if (state.bookingIntent === "service") {
    try {
      const response = await fetch(
        "/api/public-booking/preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            service_id: state.service.id,
            booking_intent: state.bookingIntent,
            ...state.details
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.ok) {
        state.paymentPreview = data;
      }
    } catch (error) {
      console.warn(
        "Unable to preview booking payment:",
        error
      );
    }
  }

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
