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

const brandingPanel =
  document.getElementById(
    "tab-branding"
  );

const hoursPanel =
  document.getElementById(
    "tab-hours"
  );

const emailPanel =
  document.getElementById(
    "tab-email"
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


  businessPanel.hidden = true;
  brandingPanel.hidden = true;
  hoursPanel.hidden = true;
  emailPanel.hidden = true;
  placeholderPanel.hidden = true;


  if (tab === "business") {

    businessPanel.hidden = false;

    return;
  }


  if (tab === "branding") {

    brandingPanel.hidden = false;

    return;
  }


  if (tab === "email") {

    emailPanel.hidden = false;

    loadEmailIntegration();

    return;
  }


  if (tab === "hours") {

    hoursPanel.hidden = false;

    loadWorkingHours();

    return;
  }


  placeholderPanel.hidden = false;


  const names = {
    payments: "Payments",
    email: "Email",
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





/* =======================================================
   Email integration
   ======================================================= */

const emailIntegrationForm =
  document.getElementById(
    "emailIntegrationForm"
  );

const emailIntegrationMessage =
  document.getElementById(
    "emailIntegrationMessage"
  );

const emailIntegrationStatus =
  document.getElementById(
    "emailIntegrationStatus"
  );

const emailEncryptionWarning =
  document.getElementById(
    "emailEncryptionWarning"
  );

const emailApiKeyHelp =
  document.getElementById(
    "emailApiKeyHelp"
  );

const disconnectEmailIntegrationButton =
  document.getElementById(
    "disconnectEmailIntegrationButton"
  );

const sendEmailTestButton =
  document.getElementById(
    "sendEmailTestButton"
  );


async function loadEmailIntegration() {

  emailIntegrationMessage.hidden =
    true;

  try {

    const response =
      await fetch(
        "/api/integrations/email",
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
        "Unable to load email settings."
      );
    }


    const integration =
      data.integration || {};


    document
      .getElementById(
        "emailFromName"
      )
      .value =
        integration.from_name ||
        "";


    document
      .getElementById(
        "emailFromEmail"
      )
      .value =
        integration.from_email ||
        "";


    document
      .getElementById(
        "emailApiKey"
      )
      .value =
        "";


    emailApiKeyHelp.textContent =
      integration.has_api_key
        ? "A Resend API key is already stored securely. Leave this blank to keep the existing key."
        : "Paste a sending-only API key from your own Resend account.";


    const statusLabels = {
      not_configured:
        "Not configured",
      configured:
        "Configured — test required",
      verified:
        "Connected",
      error:
        "Connection error",
      disabled:
        "Disabled"
    };


    emailIntegrationStatus.textContent =
      statusLabels[
        integration.status
      ] ||
      integration.status ||
      "Not configured";


    disconnectEmailIntegrationButton.hidden =
      !integration.has_api_key;


    emailEncryptionWarning.hidden =
      data.encryption_ready;


    if (!data.encryption_ready) {

      emailEncryptionWarning.textContent =
        "This installation cannot save provider credentials until ESELRAM_ENCRYPTION_KEY is added as a Cloudflare secret.";
    }


    if (integration.last_error) {

      emailIntegrationMessage.hidden =
        false;

      emailIntegrationMessage.className =
        "es-status error";

      emailIntegrationMessage.textContent =
        integration.last_error;
    }


  } catch (error) {

    emailIntegrationMessage.hidden =
      false;

    emailIntegrationMessage.className =
      "es-status error";

    emailIntegrationMessage.textContent =
      error.message ||
      "Unable to load email settings.";
  }
}


emailIntegrationForm
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const saveButton =
        document.getElementById(
          "saveEmailIntegrationButton"
        );


      saveButton.disabled =
        true;


      emailIntegrationMessage.hidden =
        false;

      emailIntegrationMessage.className =
        "es-status";

      emailIntegrationMessage.textContent =
        "Saving email settings…";


      try {

        const response =
          await fetch(
            "/api/integrations/email",
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              body:
                JSON.stringify({
                  provider:
                    "resend",

                  from_name:
                    document
                      .getElementById(
                        "emailFromName"
                      )
                      .value
                      .trim(),

                  from_email:
                    document
                      .getElementById(
                        "emailFromEmail"
                      )
                      .value
                      .trim(),

                  api_key:
                    document
                      .getElementById(
                        "emailApiKey"
                      )
                      .value
                      .trim()
                })
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
            "Unable to save email settings."
          );
        }


        emailIntegrationMessage.className =
          "es-status success";

        emailIntegrationMessage.textContent =
          "Email settings saved. Send a test email to verify the connection.";


        await loadEmailIntegration();


      } catch (error) {

        emailIntegrationMessage.hidden =
          false;

        emailIntegrationMessage.className =
          "es-status error";

        emailIntegrationMessage.textContent =
          error.message ||
          "Unable to save email settings.";

      } finally {

        saveButton.disabled =
          false;
      }
    }
  );


sendEmailTestButton
  ?.addEventListener(
    "click",
    async () => {

      const recipient =
        document
          .getElementById(
            "emailTestRecipient"
          )
          .value
          .trim();


      if (!recipient) {

        emailIntegrationMessage.hidden =
          false;

        emailIntegrationMessage.className =
          "es-status error";

        emailIntegrationMessage.textContent =
          "Enter the email address that should receive the test.";

        return;
      }


      sendEmailTestButton.disabled =
        true;

      sendEmailTestButton.textContent =
        "Sending…";


      emailIntegrationMessage.hidden =
        false;

      emailIntegrationMessage.className =
        "es-status";

      emailIntegrationMessage.textContent =
        "Sending test email…";


      try {

        const response =
          await fetch(
            "/api/integrations/email",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              body:
                JSON.stringify({
                  action:
                    "test",

                  test_email:
                    recipient
                })
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
            "Unable to send test email."
          );
        }


        emailIntegrationMessage.className =
          "es-status success";

        emailIntegrationMessage.textContent =
          data.message ||
          "Test email sent.";


        await loadEmailIntegration();


      } catch (error) {

        emailIntegrationMessage.className =
          "es-status error";

        emailIntegrationMessage.textContent =
          error.message ||
          "Unable to send test email.";

      } finally {

        sendEmailTestButton.disabled =
          false;

        sendEmailTestButton.textContent =
          "Send test email";
      }
    }
  );


disconnectEmailIntegrationButton
  ?.addEventListener(
    "click",
    async () => {

      if (
        !confirm(
          "Disconnect this business's email provider? Consultation emails will stop sending until another provider is configured."
        )
      ) {
        return;
      }


      try {

        const response =
          await fetch(
            "/api/integrations/email",
            {
              method:
                "DELETE",

              headers: {
                Accept:
                  "application/json"
              }
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
            "Unable to disconnect email provider."
          );
        }


        emailIntegrationMessage.hidden =
          false;

        emailIntegrationMessage.className =
          "es-status success";

        emailIntegrationMessage.textContent =
          "Email provider disconnected.";


        await loadEmailIntegration();


      } catch (error) {

        emailIntegrationMessage.hidden =
          false;

        emailIntegrationMessage.className =
          "es-status error";

        emailIntegrationMessage.textContent =
          error.message ||
          "Unable to disconnect email provider.";
      }
    }
  );


/* =======================================================
   Working hours settings
   ======================================================= */

const workingHoursForm =
  document.getElementById(
    "workingHoursForm"
  );

const workingHoursDays =
  document.getElementById(
    "workingHoursDays"
  );

const workingHoursStatus =
  document.getElementById(
    "workingHoursStatus"
  );

const saveWorkingHoursButton =
  document.getElementById(
    "saveWorkingHoursButton"
  );

const dayNames = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday"
};


function renderWorkingHours(days) {

  workingHoursDays.innerHTML =
    days
      .map(
        (day) => `
          <div
            class="es-hours-setting-row"
            data-weekday="${day.weekday}"
          >

            <div class="es-hours-setting-day">
              <strong>
                ${dayNames[day.weekday]}
              </strong>
            </div>


            <label class="es-check-option es-hours-open-toggle">

              <input
                type="checkbox"
                class="settings-day-open"
                ${day.is_open ? "checked" : ""}
              >

              Open

            </label>


            <input
              type="time"
              class="settings-open-time"
              value="${day.open_time || "09:00"}"
              ${day.is_open ? "" : "disabled"}
            >


            <span class="es-hours-separator">
              to
            </span>


            <input
              type="time"
              class="settings-close-time"
              value="${day.close_time || "17:00"}"
              ${day.is_open ? "" : "disabled"}
            >

          </div>
        `
      )
      .join("");


  document
    .querySelectorAll(
      ".settings-day-open"
    )
    .forEach(
      (checkbox) => {

        checkbox.addEventListener(
          "change",
          (event) => {

            const row =
              event.target.closest(
                ".es-hours-setting-row"
              );

            const openTime =
              row.querySelector(
                ".settings-open-time"
              );

            const closeTime =
              row.querySelector(
                ".settings-close-time"
              );

            openTime.disabled =
              !event.target.checked;

            closeTime.disabled =
              !event.target.checked;
          }
        );
      }
    );
}


async function loadWorkingHours() {

  try {

    workingHoursStatus.hidden = true;


    const response =
      await fetch(
        "/api/settings/hours",
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
        "Unable to load working hours."
      );
    }


    renderWorkingHours(
      data.hours || []
    );


    document
      .getElementById(
        "settingsBookingInterval"
      )
      .value =
        String(
          data.hours?.[0]
            ?.booking_interval_minutes ||
          30
        );


    document
      .getElementById(
        "settingsBufferBefore"
      )
      .value =
        String(
          data.booking_buffer_before_minutes ||
          0
        );


    document
      .getElementById(
        "settingsBufferAfter"
      )
      .value =
        String(
          data.booking_buffer_after_minutes ||
          0
        );


    document
      .getElementById(
        "settingsHoursTimezone"
      )
      .value =
        data.timezone ||
        "Europe/London";


  } catch (error) {

    workingHoursStatus.hidden =
      false;

    workingHoursStatus.className =
      "es-status error";

    workingHoursStatus.textContent =
      error.message ||
      "Unable to load working hours.";
  }
}


function collectWorkingHours() {

  return Array.from(
    document.querySelectorAll(
      ".es-hours-setting-row"
    )
  ).map(
    (row) => {

      const isOpen =
        row.querySelector(
          ".settings-day-open"
        ).checked;


      return {
        weekday:
          Number(
            row.dataset.weekday
          ),

        is_open:
          isOpen,

        open_time:
          isOpen
            ? row.querySelector(
                ".settings-open-time"
              ).value
            : null,

        close_time:
          isOpen
            ? row.querySelector(
                ".settings-close-time"
              ).value
            : null
      };
    }
  );
}


workingHoursForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    workingHoursStatus.hidden =
      false;

    workingHoursStatus.className =
      "es-status";

    workingHoursStatus.textContent =
      "Saving working hours…";

    saveWorkingHoursButton.disabled =
      true;


    const payload = {

      booking_interval_minutes:
        Number(
          document
            .getElementById(
              "settingsBookingInterval"
            )
            .value
        ),

      booking_buffer_before_minutes:
        Number(
          document
            .getElementById(
              "settingsBufferBefore"
            )
            .value
        ),

      booking_buffer_after_minutes:
        Number(
          document
            .getElementById(
              "settingsBufferAfter"
            )
            .value
        ),

      hours:
        collectWorkingHours()
    };


    try {

      const response =
        await fetch(
          "/api/settings/hours",
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
          "Unable to save working hours."
        );
      }


      workingHoursStatus.className =
        "es-status success";

      workingHoursStatus.textContent =
        "Working hours saved.";


      await loadWorkingHours();


    } catch (error) {

      workingHoursStatus.className =
        "es-status error";

      workingHoursStatus.textContent =
        error.message ||
        "Unable to save working hours.";


    } finally {

      saveWorkingHoursButton.disabled =
        false;
    }
  }
);


loadTabFromHash();
loadSettings();
