const form =
  document.getElementById(
    "businessSettingsForm"
  );

const statusBox =
  document.getElementById(
    "businessStatus"
  );

const saveButton =
  document.getElementById(
    "saveBusinessButton"
  );

const businessPanel =
  document.getElementById(
    "tab-business"
  );

const placeholderPanel =
  document.getElementById(
    "tab-placeholder"
  );

const placeholderTitle =
  document.getElementById(
    "placeholderTitle"
  );


async function loadSettings() {

  try {

    const response =
      await fetch(
        "/api/settings",
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
        "Unable to load settings."
      );
    }


    const business =
      data.business;


    document
      .getElementById(
        "businessName"
      )
      .value =
        business.name || "";


    document
      .getElementById(
        "legalName"
      )
      .value =
        business.legal_name || "";


    document
      .getElementById(
        "businessEmail"
      )
      .value =
        business.email || "";


    document
      .getElementById(
        "businessPhone"
      )
      .value =
        business.phone || "";


    document
      .getElementById(
        "businessWebsite"
      )
      .value =
        business.website || "";


    document
      .getElementById(
        "countryCode"
      )
      .value =
        business.country_code ||
        "GB";


    document
      .getElementById(
        "timezone"
      )
      .value =
        business.timezone ||
        "Europe/London";


    document
      .getElementById(
        "currency"
      )
      .value =
        business.currency ||
        "GBP";


    document
      .getElementById(
        "locale"
      )
      .value =
        business.locale ||
        "en-GB";


  } catch (error) {

    statusBox.hidden =
      false;

    statusBox.className =
      "es-status error";

    statusBox.textContent =
      error.message ||
      "Unable to load settings.";
  }
}


form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    statusBox.hidden =
      false;

    statusBox.className =
      "es-status";

    statusBox.textContent =
      "Saving changes…";

    saveButton.disabled =
      true;


    const payload = {

      name:
        document
          .getElementById(
            "businessName"
          )
          .value
          .trim(),

      legal_name:
        document
          .getElementById(
            "legalName"
          )
          .value
          .trim(),

      email:
        document
          .getElementById(
            "businessEmail"
          )
          .value
          .trim(),

      phone:
        document
          .getElementById(
            "businessPhone"
          )
          .value
          .trim(),

      website:
        document
          .getElementById(
            "businessWebsite"
          )
          .value
          .trim(),

      country_code:
        document
          .getElementById(
            "countryCode"
          )
          .value,

      timezone:
        document
          .getElementById(
            "timezone"
          )
          .value,

      currency:
        document
          .getElementById(
            "currency"
          )
          .value,

      locale:
        document
          .getElementById(
            "locale"
          )
          .value
    };


    try {

      const response =
        await fetch(
          "/api/settings",
          {
            method: "PUT",

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
          "Unable to save settings."
        );
      }


      statusBox.className =
        "es-status success";

      statusBox.textContent =
        "Changes saved.";


    } catch (error) {

      statusBox.className =
        "es-status error";

      statusBox.textContent =
        error.message ||
        "Unable to save settings.";

    } finally {

      saveButton.disabled =
        false;
    }
  }
);


function showTab(tab) {

  document
    .querySelectorAll(
      ".es-settings-tabs button"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.tab === tab
        );
      }
    );


  if (tab === "business") {

    businessPanel.hidden =
      false;

    placeholderPanel.hidden =
      true;

    return;
  }


  businessPanel.hidden =
    true;

  placeholderPanel.hidden =
    false;


  const names = {
    branding: "Branding",
    hours: "Working Hours",
    payments: "Payments",
    users: "Users",
    roles: "Roles",
    notifications:
      "Notifications",
    advanced: "Advanced"
  };


  placeholderTitle.textContent =
    names[tab] ||
    "Coming next";
}


document
  .querySelectorAll(
    ".es-settings-tabs button"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const tab =
            button.dataset.tab;

          window.location.hash =
            tab === "business"
              ? ""
              : tab;

          showTab(tab);
        }
      );
    }
  );


function loadTabFromHash() {

  const requested =
    window.location.hash
      .replace("#", "");


  showTab(
    requested || "business"
  );
}


window.addEventListener(
  "hashchange",
  loadTabFromHash
);


loadTabFromHash();
loadSettings();
