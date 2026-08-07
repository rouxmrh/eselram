const form =
  document.getElementById("paymentsForm");

const statusBox =
  document.getElementById("formStatus");

const continueButton =
  document.getElementById("continueButton");

const defaultProvider =
  document.getElementById("defaultProvider");

const providerInputs =
  Array.from(
    document.querySelectorAll(
      'input[name="provider"]'
    )
  );


const providerNames = {
  stripe: "Stripe",
  paypal: "PayPal",
  sumup: "SumUp",
  square: "Square",
  manual: "Pay at appointment"
};


function getEnabledProviders() {
  return providerInputs
    .filter((input) => input.checked)
    .map((input) => input.value);
}


function updateDefaultProviderOptions() {
  const enabledProviders =
    getEnabledProviders();

  const previousValue =
    defaultProvider.value;

  defaultProvider.innerHTML = "";

  enabledProviders.forEach((provider) => {
    const option =
      document.createElement("option");

    option.value = provider;
    option.textContent =
      providerNames[provider];

    defaultProvider.appendChild(option);
  });

  if (
    enabledProviders.includes(
      previousValue
    )
  ) {
    defaultProvider.value =
      previousValue;
  }
}


providerInputs.forEach((input) => {
  input.addEventListener(
    "change",
    updateDefaultProviderOptions
  );
});


form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const enabledProviders =
      getEnabledProviders();

    if (enabledProviders.length === 0) {
      statusBox.hidden = false;
      statusBox.className =
        "es-status error";

      statusBox.textContent =
        "Please select at least one payment method.";

      return;
    }


    const selectedDefault =
      defaultProvider.value;

    if (
      !enabledProviders.includes(
        selectedDefault
      )
    ) {
      statusBox.hidden = false;
      statusBox.className =
        "es-status error";

      statusBox.textContent =
        "Please choose a valid default payment method.";

      return;
    }


    statusBox.hidden = false;
    statusBox.className =
      "es-status";

    statusBox.textContent =
      "Saving your payment preferences…";

    continueButton.disabled = true;


    const payload = {
      enabled_providers:
        enabledProviders,

      default_provider:
        selectedDefault
    };


    try {
      const response =
        await fetch(
          "/api/install/payments",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json"
            },

            body:
              JSON.stringify(payload)
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
          "Unable to save payment preferences."
        );
      }


      statusBox.classList.add(
        "success"
      );

      statusBox.textContent =
        "Payment preferences saved.";


      window.location.href =
        "/installer/owner.html";


    } catch (error) {
      console.error(error);

      statusBox.classList.add(
        "error"
      );

      statusBox.textContent =
        error.message ||
        "Something went wrong.";

      continueButton.disabled =
        false;
    }
  }
);


updateDefaultProviderOptions();
