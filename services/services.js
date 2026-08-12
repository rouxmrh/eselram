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


paymentTiming.addEventListener(
  "change",
  updatePaymentFields
);


requiresConsultation.addEventListener(
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


    renderServices();

    renderProviders();

    renderClientForms();


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

function renderServices() {

  if (services.length === 0) {

    servicesList.className =
      "es-empty-state";

    servicesList.innerHTML = `
      <strong>
        No services yet.
      </strong>

      <span>
        Create your first service
        to start taking bookings.
      </span>
    `;

    return;
  }


  servicesList.className =
    "es-services-list";


  servicesList.innerHTML =
    services
      .map(
        (service) => `
          <article class="es-service-row">

            <div class="es-service-main">

              <div>
                <strong>
                  ${escapeHtml(
                    service.name
                  )}
                </strong>

                ${
                  service.is_active
                    ? ""
                    : `
                      <span
                        class="es-service-badge"
                      >
                        Inactive
                      </span>
                    `
                }
              </div>

              <span>
                ${
                  service.duration_minutes
                } minutes
                ·
                ${formatMoney(
                  service.price_minor
                )}
              </span>

            </div>


            <button
              class="es-secondary-button"
              type="button"
              data-edit="${
                service.id
              }"
            >
              Edit
            </button>

          </article>
        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-edit]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const service =
              services.find(
                (item) =>
                  item.id ===
                  button.dataset.edit
              );

            if (service) {
              openForm(service);
            }
          }
        );
      }
    );
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


    requiresConsultation.checked =
      service.requires_consultation
      === 1;

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

  consultationBookingSection.hidden =
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
