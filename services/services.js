const formPanel =
  document.getElementById(
    "serviceFormPanel"
  );

const form =
  document.getElementById(
    "serviceForm"
  );

const servicesList =
  document.getElementById(
    "servicesList"
  );

const statusBox =
  document.getElementById(
    "formStatus"
  );

const paymentTiming =
  document.getElementById(
    "paymentTiming"
  );

const depositField =
  document.getElementById(
    "depositField"
  );

const providerSection =
  document.getElementById(
    "providerSection"
  );


const consultationBookingSection =
  document.getElementById(
    "consultationBookingSection"
  );

const requiresConsultation =
  document.getElementById(
    "requiresConsultation"
  );

const serviceType =
  document.getElementById(
    "serviceType"
  );

const requiredConsultationService =
  document.getElementById(
    "requiredConsultationService"
  );

const requiredConsultationServiceWrap =
  document.getElementById(
    "requiredConsultationServiceWrap"
  );

const consultationDuration =
  document.getElementById(
    "consultationDuration"
  );

const consultationPrice =
  document.getElementById(
    "consultationPrice"
  );

const consultationPaymentTiming =
  document.getElementById(
    "consultationPaymentTiming"
  );

const providerOptions =
  document.getElementById(
    "providerOptions"
  );

const clientFormOptions =
  document.getElementById(
    "clientFormOptions"
  );

const servicesActiveCount = document.getElementById("servicesActiveCount");
const servicesConsultationCount = document.getElementById("servicesConsultationCount");
const servicesPatchCount = document.getElementById("servicesPatchCount");
const servicesFormsCount = document.getElementById("servicesFormsCount");
const serviceSearch = document.getElementById("serviceSearch");
const serviceStatusFilter = document.getElementById("serviceStatusFilter");
const closeServiceEditorButton = document.getElementById("closeServiceEditorButton");
const serviceFamilyPills = document.getElementById("serviceFamilyPills");

let selectedServiceFamily = "";

let services = [];
let providers = [];
let clientTemplates = [];


document
  .getElementById(
    "newServiceButton"
  )
  .addEventListener(
    "click",
    () => openForm()
  );


document
  .getElementById(
    "cancelServiceButton"
  )
  .addEventListener(
    "click",
    closeForm
  );

closeServiceEditorButton?.addEventListener("click", closeForm);
serviceSearch?.addEventListener("input", renderServices);
serviceStatusFilter?.addEventListener("change", renderServices);


paymentTiming.addEventListener(
  "change",
  updatePaymentFields
);


requiresConsultation.addEventListener(
  "change",
  updateConsultationFields
);

serviceType.addEventListener(
  "change",
  updateConsultationFields
);

requiredConsultationService.addEventListener(
  "change",
  updateConsultationFields
);


async function loadServices() {

  try {

    const response =
      await fetch(
        "/api/services",
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
      response.status === 401
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
        "Unable to load services."
      );
    }


    services =
      data.services || [];


    providers =
      data.providers || [];

    clientTemplates =
      data.client_templates || [];


    renderServiceSummary();
    renderServices();

    renderProviders();

    renderClientForms();

    renderConsultationServiceOptions();


  } catch (error) {

    servicesList.className =
      "es-status error";

    servicesList.textContent =
      error.message ||
      "Unable to load services.";
  }
}


function renderProviders(
  selected = []
) {

  if (providers.length === 0) {

    providerOptions.innerHTML = `
      <p class="es-muted-copy">
        No online payment providers
        are currently enabled.
      </p>
    `;

    return;
  }


  providerOptions.innerHTML =
    providers
      .map(
        (provider) => `
          <label class="es-check-option">

            <input
              type="checkbox"
              name="serviceProvider"
              value="${escapeHtml(
                provider.provider_key
              )}"
              ${
                selected.includes(
                  provider.provider_key
                )
                  ? "checked"
                  : ""
              }
            >

            ${escapeHtml(
              provider.display_name
            )}

          </label>
        `
      )
      .join("");
}


function renderClientForms(selectedRules = []) {
  if (!clientFormOptions) return;
  if (clientTemplates.length === 0) {
    clientFormOptions.innerHTML = `<p class="es-muted-copy">No published client-sendable forms are available. Create/publish a form template and mark it client sendable first.</p>`;
    return;
  }
  const selectedMap = new Map((selectedRules || []).map((rule) => [rule.template_id, rule.trigger_event || "manual"]));
  clientFormOptions.innerHTML = clientTemplates.map((template) => {
    const trigger = selectedMap.get(template.id);
    const checked = trigger ? "checked" : "";
    return `<div class="es-service-row" data-client-form-row="${escapeHtml(template.id)}" style="align-items:center;">
      <label class="es-check-option" style="flex:1;">
        <input type="checkbox" name="serviceClientForm" value="${escapeHtml(template.id)}" ${checked}>
        <span><strong>${escapeHtml(template.name)}</strong><small style="display:block;">${escapeHtml(template.template_type || "custom")}</small></span>
      </label>
      <label>Send when
        <select class="service-client-form-trigger" data-template-id="${escapeHtml(template.id)}" ${checked ? "" : "disabled"}>
          <option value="payment_received" ${trigger === "payment_received" ? "selected" : ""}>Payment / deposit received</option>
          <option value="booking_confirmed" ${trigger === "booking_confirmed" ? "selected" : ""}>Booking confirmed</option>
          <option value="manual" ${!trigger || trigger === "manual" ? "selected" : ""}>Manually only</option>
        </select>
      </label>
    </div>`;
  }).join("");
  document.querySelectorAll('input[name="serviceClientForm"]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const trigger = document.querySelector(`.service-client-form-trigger[data-template-id="${CSS.escape(checkbox.value)}"]`);
      if (trigger) trigger.disabled = !checkbox.checked;
    });
  });
}

function renderConsultationServiceOptions(selectedId = "") {
  const currentServiceId =
    document.getElementById("serviceId")?.value || "";

  const consultationServices =
    services.filter(
      service =>
        service.id !== currentServiceId &&
        String(service.service_type || "standard") === "consultation" &&
        Number(service.is_active) === 1
    );

  requiredConsultationService.innerHTML = `
    <option value="">Choose consultation service</option>
    ${consultationServices.map(service => `
      <option
        value="${escapeHtml(service.id)}"
        ${service.id === selectedId ? "selected" : ""}
      >
        ${escapeHtml(service.name)}
      </option>
    `).join("")}
  `;
}


function renderServiceSummary() {
  servicesActiveCount.textContent = services.filter(service => Number(service.is_active) === 1).length;
  servicesConsultationCount.textContent = services.filter(
    service =>
      String(service.service_type || "standard") === "consultation" ||
      Number(service.requires_consultation) === 1
  ).length;
  servicesPatchCount.textContent = services.filter(service => Number(service.requires_patch_test) === 1).length;
  servicesFormsCount.textContent = services.reduce((total, service) => total + (service.form_rules || []).filter(rule => Number(rule.is_active ?? 1) === 1).length, 0);
}

function servicePaymentLabel(service) {
  const labels = {
    pay_at_appointment: "Pay at appointment",
    online_full: "Full payment online",
    online_deposit: `Deposit ${formatMoney(service.deposit_minor || 0)}`,
    free: "No payment"
  };
  return labels[service.payment_timing] || service.payment_timing || "—";
}

function serviceConsultationLabel(service) {
  if (Number(service.requires_consultation) !== 1) return "No consultation";
  return `${Number(service.consultation_duration_minutes || 30)} min · ${formatMoney(service.consultation_price_minor || 0)}`;
}

function serviceFamilyName(service) {
  const configured =
    String(
      service.booking_group ||
      ""
    ).trim();

  if (configured) {
    return configured;
  }

  const name =
    String(
      service.name ||
      "Other"
    ).trim();

  if (
    String(
      service.service_type ||
      "standard"
    ) === "consultation"
  ) {
    return (
      name.replace(
        /\s+consultation$/i,
        ""
      ).trim() ||
      name
    );
  }

  return name;
}


function renderServices() {
  const query =
    String(
      serviceSearch?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const filter =
    serviceStatusFilter?.value ||
    "all";

  const filtered =
    services.filter(service => {
      if (
        filter === "active" &&
        Number(service.is_active) !== 1
      ) return false;

      if (
        filter === "inactive" &&
        Number(service.is_active) === 1
      ) return false;

      if (
        filter === "consultation" &&
        String(
          service.service_type ||
          "standard"
        ) !== "consultation" &&
        Number(
          service.requires_consultation
        ) !== 1
      ) return false;

      if (
        filter === "patch" &&
        Number(
          service.requires_patch_test
        ) !== 1
      ) return false;

      if (!query) return true;

      return [
        service.name,
        service.booking_group,
        service.description,
        servicePaymentLabel(service)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

  if (filtered.length === 0) {
    if (serviceFamilyPills) {
      serviceFamilyPills.innerHTML = "";
    }

    servicesList.className =
      "es-empty-state";

    servicesList.innerHTML =
      `<strong>No matching services.</strong><span>Try changing the search or filter.</span>`;

    return;
  }

  const families =
    [...new Set(
      filtered.map(
        service =>
          serviceFamilyName(service)
      )
    )]
      .sort(
        (a, b) =>
          a.localeCompare(
            b,
            undefined,
            {
              sensitivity: "base"
            }
          )
      );

  if (
    !selectedServiceFamily ||
    !families.includes(
      selectedServiceFamily
    )
  ) {
    selectedServiceFamily =
      families[0];
  }

  if (serviceFamilyPills) {
    serviceFamilyPills.innerHTML =
      families
        .map(
          family => `
            <button
              class="es-service-family-pill ${
                family ===
                selectedServiceFamily
                  ? "is-active"
                  : ""
              }"
              type="button"
              data-service-family="${escapeHtml(family)}"
            >
              ${escapeHtml(family)}
            </button>
          `
        )
        .join("");

    serviceFamilyPills
      .querySelectorAll(
        "[data-service-family]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            selectedServiceFamily =
              button.dataset
                .serviceFamily ||
              "";

            renderServices();
          }
        );
      });
  }

  const visible =
    filtered.filter(
      service =>
        serviceFamilyName(service) ===
        selectedServiceFamily
    );

  servicesList.className = "";

  servicesList.innerHTML = `
    <div class="es-service-family-heading">
      <strong>${escapeHtml(selectedServiceFamily)}</strong>
      <span>${visible.length} ${
        visible.length === 1
          ? "service"
          : "services"
      }</span>
    </div>

    <div class="es-services-grid">
      ${visible.map(service => {
        const active =
          Number(
            service.is_active
          ) === 1;

        const standaloneConsultation =
          String(
            service.service_type ||
            "standard"
          ) ===
            "consultation";

        const consultation =
          standaloneConsultation ||
          Number(
            service.requires_consultation
          ) === 1;

        const patch =
          Number(
            service.requires_patch_test
          ) === 1;

        const formCount =
          (
            service.form_rules ||
            []
          )
            .filter(
              rule =>
                Number(
                  rule.is_active ??
                  1
                ) === 1
            )
            .length;

        const providerCount =
          (
            service.providers ||
            []
          ).length;

        return `
          <article class="es-service-card ${active ? "" : "is-inactive"}">
            <div class="es-service-card-header">
              <div class="es-service-card-title">
                <h3>${escapeHtml(service.name)}</h3>
                <p>${escapeHtml(service.description || "No description added.")}</p>
              </div>

              <span class="es-service-status ${active ? "" : "inactive"}">
                ${active ? "Active" : "Inactive"}
              </span>
            </div>

            <div class="es-service-card-metrics">
              <div class="es-service-metric">
                <span>Duration</span>
                <strong>${Number(service.duration_minutes)} min</strong>
              </div>

              <div class="es-service-metric">
                <span>Price</span>
                <strong>${formatMoney(service.price_minor)}</strong>
              </div>

              <div class="es-service-metric">
                <span>Payment</span>
                <strong>${escapeHtml(servicePaymentLabel(service))}</strong>
              </div>
            </div>

            <div class="es-service-card-rules">
              <span class="es-service-rule-pill ${consultation ? "on" : ""}">
                ${
                  standaloneConsultation
                    ? "Consultation service"
                    : `Consultation ${consultation ? "required" : "not required"}`
                }
              </span>

              <span class="es-service-rule-pill ${patch ? "on" : ""}">
                Patch test ${patch ? "required" : "not required"}
              </span>

              <span class="es-service-rule-pill ${formCount > 0 ? "on" : ""}">
                ${formCount} client ${formCount === 1 ? "form" : "forms"}
              </span>
            </div>

            <div class="es-service-card-footer">
              <small>
                ${
                  consultation
                    ? `Consultation: ${escapeHtml(serviceConsultationLabel(service))}`
                    : (
                        providerCount > 0
                          ? `${providerCount} online payment ${providerCount === 1 ? "provider" : "providers"}`
                          : "No consultation workflow"
                      )
                }
              </small>

              <div class="es-service-card-footer-actions">
                <button
                  class="es-secondary-button es-service-edit"
                  type="button"
                  data-edit="${escapeHtml(service.id)}"
                >
                  Edit service
                </button>
                <button
                  class="es-secondary-button es-service-delete"
                  type="button"
                  data-delete-service="${escapeHtml(service.id)}"
                  data-delete-service-name="${escapeHtml(service.name)}"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  document
    .querySelectorAll(
      "[data-edit]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const service =
            services.find(
              item =>
                item.id ===
                button.dataset.edit
            );

          if (service) {
            openForm(service);
          }
        }
      );
    });

  document
    .querySelectorAll("[data-delete-service]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        const serviceId = button.dataset.deleteService;
        const serviceName = button.dataset.deleteServiceName || "this service";

        if (!window.confirm(
          `Delete "${serviceName}"?\n\nThis is only allowed when the service has no bookings, packages or other records that depend on it.`
        )) return;

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Deleting…";

        try {
          const response = await fetch(
            `/api/services?id=${encodeURIComponent(serviceId)}`,
            { method:"DELETE", headers:{Accept:"application/json"} }
          );
          const data = await response.json();

          if (!response.ok || !data.ok) {
            throw new Error(data.error || "Unable to delete service.");
          }

          services = services.filter(service => service.id !== serviceId);
          renderServiceSummary();
          renderConsultationServiceOptions();
          renderServices();
        } catch (error) {
          window.alert(error.message || "Unable to delete service.");
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });

}



function openForm(
  service = null
) {

  form.reset();

  document
    .getElementById(
      "serviceId"
    )
    .value =
      service?.id || "";


  document
    .getElementById(
      "serviceFormTitle"
    )
    .textContent =
      service
        ? "Edit service"
        : "Add service";


  if (service) {

    document
      .getElementById(
        "serviceName"
      )
      .value =
        service.name;


    document
      .getElementById(
        "serviceDescription"
      )
      .value =
        service.description || "";

    document
      .getElementById(
        "serviceBookingGroup"
      )
      .value =
        service.booking_group || "";


    document
      .getElementById(
        "serviceDuration"
      )
      .value =
        String(
          service.duration_minutes
        );


    document
      .getElementById(
        "servicePrice"
      )
      .value =
        (
          service.price_minor /
          100
        ).toFixed(2);


    paymentTiming.value =
      service.payment_timing;


    document
      .getElementById(
        "serviceDeposit"
      )
      .value =
        (
          service.deposit_minor /
          100
        ).toFixed(2);


    serviceType.value =
      service.service_type ||
      "standard";

    requiresConsultation.checked =
      service.requires_consultation
      === 1;

    renderConsultationServiceOptions(
      service.consultation_service_id ||
      ""
    );

    document
      .getElementById(
        "postConsultationBooking"
      )
      .value =
        service.post_consultation_booking ||
        "client_can_book";

    consultationDuration.value =
      String(
        service.consultation_duration_minutes ||
        30
      );

    consultationPrice.value =
      (
        Number(
          service.consultation_price_minor ||
          0
        ) /
        100
      ).toFixed(2);

    consultationPaymentTiming.value =
      service.consultation_payment_timing ||
      (
        Number(
          service.consultation_price_minor ||
          0
        ) > 0
          ? "online_full"
          : "free"
      );


    document
      .getElementById(
        "requiresPatchTest"
      )
      .checked =
        service.requires_patch_test
        === 1;


    document
      .getElementById(
        "serviceActive"
      )
      .checked =
        service.is_active === 1;


    renderProviders(
      service.providers || []
    );

    renderClientForms(
      service.form_rules || []
    );

  } else {

    serviceType.value =
      "standard";

    document
      .getElementById(
        "serviceBookingGroup"
      )
      .value = "";

    renderConsultationServiceOptions();

    document
      .getElementById(
        "postConsultationBooking"
      )
      .value = "client_can_book";

    document
      .getElementById(
        "serviceActive"
      )
      .checked = true;

    requiresConsultation.checked =
      false;

    consultationDuration.value =
      "30";

    consultationPrice.value =
      "0.00";

    consultationPaymentTiming.value =
      "free";

    renderProviders();

    renderClientForms();
  }


  updatePaymentFields();
  updateConsultationFields();

  statusBox.hidden = true;

  formPanel.hidden = false;

  formPanel.scrollIntoView({
    behavior: "smooth"
  });
}


function closeForm() {

  formPanel.hidden = true;
}


function updateConsultationFields() {
  const isConsultationService =
    serviceType.value === "consultation";

  if (isConsultationService) {
    requiresConsultation.checked = false;
  }

  requiresConsultation.disabled =
    isConsultationService;

  requiredConsultationServiceWrap.hidden =
    isConsultationService ||
    !requiresConsultation.checked;

  const hasLinkedConsultation =
    Boolean(requiredConsultationService.value);

  consultationBookingSection.hidden =
    isConsultationService ||
    !requiresConsultation.checked ||
    hasLinkedConsultation;

  document
    .getElementById("postConsultationBookingWrap")
    .hidden =
      isConsultationService ||
      !requiresConsultation.checked;
}


function updatePaymentFields() {

  const value =
    paymentTiming.value;


  depositField.hidden =
    value !==
    "online_deposit";


  providerSection.hidden =
    ![
      "online_full",
      "online_deposit"
    ].includes(value);
}


form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      document
        .getElementById(
          "serviceId"
        )
        .value;


    const selectedProviders =
      Array.from(
        document.querySelectorAll(
          'input[name="serviceProvider"]:checked'
        )
      ).map(
        (input) =>
          input.value
      );


    const selectedFormRules =
      Array.from(
        document.querySelectorAll(
          'input[name="serviceClientForm"]:checked'
        )
      ).map((input) => {
        const trigger = document.querySelector(
          `.service-client-form-trigger[data-template-id="${CSS.escape(input.value)}"]`
        );
        return {
          template_id: input.value,
          trigger_event: trigger?.value || "manual"
        };
      });


    const payload = {

      id,

      name:
        document
          .getElementById(
            "serviceName"
          )
          .value
          .trim(),

      description:
        document
          .getElementById(
            "serviceDescription"
          )
          .value
          .trim(),

      booking_group:
        document
          .getElementById(
            "serviceBookingGroup"
          )
          .value
          .trim(),

      service_type:
        serviceType.value,

      consultation_service_id:
        (
          serviceType.value === "standard" &&
          requiresConsultation.checked
        )
          ? (requiredConsultationService.value || null)
          : null,

      post_consultation_booking:
        document
          .getElementById(
            "postConsultationBooking"
          )
          .value,

      duration_minutes:
        Number(
          document
            .getElementById(
              "serviceDuration"
            )
            .value
        ),

      price:
        Number(
          document
            .getElementById(
              "servicePrice"
            )
            .value
        ),

      deposit:
        Number(
          document
            .getElementById(
              "serviceDeposit"
            )
            .value || 0
        ),

      payment_timing:
        paymentTiming.value,

      providers:
        selectedProviders,

      form_rules:
        selectedFormRules,

      requires_consultation:
        serviceType.value === "standard" &&
        requiresConsultation.checked,

      consultation_duration_minutes:
        Number(
          consultationDuration.value ||
          30
        ),

      consultation_price:
        Number(
          consultationPrice.value ||
          0
        ),

      consultation_payment_timing:
        consultationPaymentTiming.value,

      requires_patch_test:
        document
          .getElementById(
            "requiresPatchTest"
          )
          .checked,

      is_active:
        document
          .getElementById(
            "serviceActive"
          )
          .checked
    };


    statusBox.hidden = false;
    statusBox.className =
      "es-status";

    statusBox.textContent =
      id
        ? "Updating service…"
        : "Creating service…";


    try {

      const response =
        await fetch(
          "/api/services",
          {
            method:
              id
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


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          "Unable to save service."
        );
      }


      statusBox.className =
        "es-status success";

      statusBox.textContent =
        "Service saved.";


      await loadServices();


      setTimeout(
        closeForm,
        400
      );


    } catch (error) {

      statusBox.className =
        "es-status error";

      statusBox.textContent =
        error.message ||
        "Unable to save service.";
    }
  }
);


function formatMoney(
  amountMinor
) {

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP"
    }
  ).format(
    amountMinor / 100
  );
}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}


loadServices();
