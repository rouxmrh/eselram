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

const providerOptions =
  document.getElementById(
    "providerOptions"
  );


let services = [];
let providers = [];


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


    renderServices();

    renderProviders();


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


    document
      .getElementById(
        "requiresConsultation"
      )
      .checked =
        service.requires_consultation
        === 1;


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

  } else {

    document
      .getElementById(
        "serviceActive"
      )
      .checked = true;

    renderProviders();
  }


  updatePaymentFields();

  statusBox.hidden = true;

  formPanel.hidden = false;

  formPanel.scrollIntoView({
    behavior: "smooth"
  });
}


function closeForm() {

  formPanel.hidden = true;
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

      requires_consultation:
        document
          .getElementById(
            "requiresConsultation"
          )
          .checked,

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
