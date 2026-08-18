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

const paymentsPanel =
  document.getElementById(
    "tab-payments"
  );

const emailPanel =
  document.getElementById(
    "tab-email"
  );

const notificationsPanel =
  document.getElementById(
    "tab-notifications"
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
  paymentsPanel.hidden = true;
  emailPanel.hidden = true;
  notificationsPanel.hidden = true;
  placeholderPanel.hidden = true;


  if (tab === "business") {

    businessPanel.hidden = false;

    return;
  }


  if (tab === "branding") {

    brandingPanel.hidden = false;

    return;
  }


  if (tab === "payments") {

    paymentsPanel.hidden = false;

    loadStripeIntegration();

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


  if (tab === "notifications") {

    notificationsPanel.hidden = false;

    loadNotificationSettings();

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
   Independent Stripe integration
   ======================================================= */

const stripeIntegrationForm =
  document.getElementById(
    "stripeIntegrationForm"
  );

const stripeIntegrationMessage =
  document.getElementById(
    "stripeIntegrationMessage"
  );

const stripeIntegrationStatus =
  document.getElementById(
    "stripeIntegrationStatus"
  );

const stripeIntegrationMode =
  document.getElementById(
    "stripeIntegrationMode"
  );

const stripeDefaultStatus =
  document.getElementById(
    "stripeDefaultStatus"
  );

const stripeEncryptionWarning =
  document.getElementById(
    "stripeEncryptionWarning"
  );

const stripeSecretKeyHelp =
  document.getElementById(
    "stripeSecretKeyHelp"
  );

const stripeWebhookSecretHelp =
  document.getElementById(
    "stripeWebhookSecretHelp"
  );

const testStripeIntegrationButton =
  document.getElementById(
    "testStripeIntegrationButton"
  );

const disconnectStripeIntegrationButton =
  document.getElementById(
    "disconnectStripeIntegrationButton"
  );


async function loadStripeIntegration() {

  stripeIntegrationMessage.hidden =
    true;


  try {

    const response =
      await fetch(
        "/api/integrations/payments/stripe",
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
      response.status ===
      401
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
        "Unable to load Stripe settings."
      );
    }


    const integration =
      data.integration ||
      {};


    document
      .getElementById(
        "stripePublishableKey"
      )
      .value =
        integration.publishable_key ||
        "";


    document
      .getElementById(
        "stripeCurrency"
      )
      .value =
        integration.currency ||
        document
          .getElementById(
            "currency"
          )
          ?.value ||
        "GBP";


    document
      .getElementById(
        "stripeSecretKey"
      )
      .value =
        "";


    document
      .getElementById(
        "stripeWebhookSecret"
      )
      .value =
        "";


    document
      .getElementById(
        "stripeWebhookUrl"
      )
      .value =
        integration.webhook_url ||
        "";


    document
      .getElementById(
        "stripeMakeDefault"
      )
      .checked =
        integration.is_default !==
        false;


    stripeSecretKeyHelp.textContent =
      integration.has_secret_key
        ? "A Stripe server-side key is already stored securely. Leave this blank to keep the existing key."
        : "Paste a Stripe secret or restricted server-side key owned by this business.";


    stripeWebhookSecretHelp.textContent =
      integration.has_webhook_secret
        ? "A webhook signing secret is already stored securely. Leave this blank to keep it."
        : "Optional at this stage. Add it when the Stripe webhook endpoint is enabled.";


    const labels = {
      not_configured:
        "Not configured",
      configured:
        "Connected — sending test required",
      verified:
        "Ready to send",
      error:
        "Sending setup required",
      disabled:
        "Disabled"
    };


    stripeIntegrationStatus.textContent =
      labels[
        integration.status
      ] ||
      integration.status ||
      "Not configured";


    stripeIntegrationMode.textContent =
      integration.mode ===
        "live"
        ? "Live"
        : integration.mode ===
            "sandbox"
          ? "Test"
          : "—";


    stripeDefaultStatus.textContent =
      integration.is_default
        ? "Yes"
        : "No";


    disconnectStripeIntegrationButton.hidden =
      !integration.has_secret_key;


    stripeEncryptionWarning.hidden =
      data.encryption_ready;


    if (!data.encryption_ready) {

      stripeEncryptionWarning.textContent =
        "This installation cannot save Stripe credentials until ESELRAM_ENCRYPTION_KEY is configured.";
    }


    if (integration.last_error) {

      stripeIntegrationMessage.hidden =
        false;

      stripeIntegrationMessage.className =
        "es-status error";

      stripeIntegrationMessage.textContent =
        integration.last_error;
    }


  } catch (error) {

    stripeIntegrationMessage.hidden =
      false;

    stripeIntegrationMessage.className =
      "es-status error";

    stripeIntegrationMessage.textContent =
      error.message ||
      "Unable to load Stripe settings.";
  }
}




document
  .getElementById(
    "copyStripeWebhookUrl"
  )
  ?.addEventListener(
    "click",
    async () => {

      const input =
        document.getElementById(
          "stripeWebhookUrl"
        );


      if (!input?.value) {
        return;
      }


      try {

        await navigator.clipboard.writeText(
          input.value
        );

      } catch {

        input.select();

        document.execCommand(
          "copy"
        );
      }
    }
  );


stripeIntegrationForm
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const button =
        document.getElementById(
          "saveStripeIntegrationButton"
        );


      button.disabled =
        true;


      stripeIntegrationMessage.hidden =
        false;

      stripeIntegrationMessage.className =
        "es-status";

      stripeIntegrationMessage.textContent =
        "Saving Stripe settings…";


      try {

        const response =
          await fetch(
            "/api/integrations/payments/stripe",
            {
              method:
                "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              body:
                JSON.stringify({
                  publishable_key:
                    document
                      .getElementById(
                        "stripePublishableKey"
                      )
                      .value
                      .trim(),

                  secret_key:
                    document
                      .getElementById(
                        "stripeSecretKey"
                      )
                      .value
                      .trim(),

                  webhook_secret:
                    document
                      .getElementById(
                        "stripeWebhookSecret"
                      )
                      .value
                      .trim(),

                  currency:
                    document
                      .getElementById(
                        "stripeCurrency"
                      )
                      .value,

                  make_default:
                    document
                      .getElementById(
                        "stripeMakeDefault"
                      )
                      .checked
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
            "Unable to save Stripe settings."
          );
        }


        stripeIntegrationMessage.className =
          "es-status success";

        stripeIntegrationMessage.textContent =
          "Stripe settings saved. Test the connection before using it.";


        await loadStripeIntegration();


      } catch (error) {

        stripeIntegrationMessage.hidden =
          false;

        stripeIntegrationMessage.className =
          "es-status error";

        stripeIntegrationMessage.textContent =
          error.message ||
          "Unable to save Stripe settings.";

      } finally {

        button.disabled =
          false;
      }
    }
  );


testStripeIntegrationButton
  ?.addEventListener(
    "click",
    async () => {

      testStripeIntegrationButton.disabled =
        true;

      testStripeIntegrationButton.textContent =
        "Testing…";


      stripeIntegrationMessage.hidden =
        false;

      stripeIntegrationMessage.className =
        "es-status";

      stripeIntegrationMessage.textContent =
        "Checking the Stripe connection…";


      try {

        const response =
          await fetch(
            "/api/integrations/payments/stripe",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              body:
                JSON.stringify({
                  action:
                    "test"
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
            "Stripe connection test failed."
          );
        }


        stripeIntegrationMessage.className =
          "es-status success";

        stripeIntegrationMessage.textContent =
          data.message ||
          "Stripe connection verified.";


        await loadStripeIntegration();


      } catch (error) {

        stripeIntegrationMessage.className =
          "es-status error";

        stripeIntegrationMessage.textContent =
          error.message ||
          "Stripe connection test failed.";

      } finally {

        testStripeIntegrationButton.disabled =
          false;

        testStripeIntegrationButton.textContent =
          "Test connection";
      }
    }
  );


disconnectStripeIntegrationButton
  ?.addEventListener(
    "click",
    async () => {

      if (
        !confirm(
          "Disconnect Stripe from this business? Pay at appointment will become the default payment method."
        )
      ) {
        return;
      }


      try {

        const response =
          await fetch(
            "/api/integrations/payments/stripe",
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
            "Unable to disconnect Stripe."
          );
        }


        stripeIntegrationMessage.hidden =
          false;

        stripeIntegrationMessage.className =
          "es-status success";

        stripeIntegrationMessage.textContent =
          "Stripe disconnected. Pay at appointment is now the default.";


        await loadStripeIntegration();


      } catch (error) {

        stripeIntegrationMessage.hidden =
          false;

        stripeIntegrationMessage.className =
          "es-status error";

        stripeIntegrationMessage.textContent =
          error.message ||
          "Unable to disconnect Stripe.";
      }
    }
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
        "Connected — sending test required",
      verified:
        "Ready to send",
      error:
        "Sending setup required",
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
          "Email settings saved. If the sending domain is verified in Resend, send a test email to activate automated client emails.";


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



let blockedDatesState = [];

function validBlockedDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
}

function normaliseBlockedDates(value) {
  return (Array.isArray(value) ? value : [])
    .filter(Boolean)
    .map((item) => {
      const legacyDate =
        String(item.date || "").trim();

      const startDate =
        String(
          item.start_date ||
          legacyDate ||
          ""
        ).trim();

      const endDate =
        String(
          item.end_date ||
          legacyDate ||
          startDate ||
          ""
        ).trim();

      return {
        start_date: startDate,
        end_date: endDate,
        reason:
          String(item.reason || "").trim()
      };
    })
    .filter(
      (item) =>
        validBlockedDate(item.start_date) &&
        validBlockedDate(item.end_date) &&
        item.start_date <= item.end_date
    )
    .sort(
      (a, b) =>
        a.start_date.localeCompare(
          b.start_date
        ) ||
        a.end_date.localeCompare(
          b.end_date
        )
    );
}

function formatBlockedRange(item) {
  return item.start_date === item.end_date
    ? item.start_date
    : `${item.start_date} → ${item.end_date}`;
}

function renderBlockedDates() {
  const container =
    document.getElementById(
      "blockedDatesList"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!blockedDatesState.length) {
    container.innerHTML = `
      <div class="es-empty-state">
        <strong>No blocked dates</strong>
        <span>Clients and staff can book any open day within your booking rules.</span>
      </div>
    `;
    return;
  }

  blockedDatesState.forEach(
    (item, index) => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "es-service-row";

      const main =
        document.createElement(
          "div"
        );

      main.className =
        "es-service-main";

      const dateStrong =
        document.createElement(
          "strong"
        );

      dateStrong.textContent =
        formatBlockedRange(item);

      const reason =
        document.createElement(
          "span"
        );

      reason.textContent =
        item.reason ||
        "Blocked";

      const remove =
        document.createElement(
          "button"
        );

      remove.type = "button";
      remove.className =
        "es-secondary-button";
      remove.textContent =
        "Remove";

      remove.addEventListener(
        "click",
        () => {
          blockedDatesState =
            blockedDatesState.filter(
              (_, itemIndex) =>
                itemIndex !== index
            );

          renderBlockedDates();
        }
      );

      main.append(
        dateStrong,
        reason
      );

      row.append(
        main,
        remove
      );

      container.appendChild(row);
    }
  );
}

function addBlockedDate() {
  const fromInput =
    document.getElementById(
      "settingsBlockedFromDate"
    );

  const toInput =
    document.getElementById(
      "settingsBlockedToDate"
    );

  const reasonInput =
    document.getElementById(
      "settingsBlockedReason"
    );

  const startDate =
    String(
      fromInput?.value ||
      ""
    ).trim();

  const endDate =
    String(
      toInput?.value ||
      startDate ||
      ""
    ).trim();

  const reason =
    String(
      reasonInput?.value ||
      ""
    ).trim();

  if (
    !validBlockedDate(startDate) ||
    !validBlockedDate(endDate)
  ) {
    workingHoursStatus.hidden =
      false;

    workingHoursStatus.className =
      "es-status error";

    workingHoursStatus.textContent =
      "Choose a valid From and To date.";

    return;
  }

  if (endDate < startDate) {
    workingHoursStatus.hidden =
      false;

    workingHoursStatus.className =
      "es-status error";

    workingHoursStatus.textContent =
      "The To date must be the same as or later than the From date.";

    return;
  }

  blockedDatesState.push({
    start_date: startDate,
    end_date: endDate,
    reason
  });

  blockedDatesState =
    normaliseBlockedDates(
      blockedDatesState
    );

  if (fromInput) {
    fromInput.value = "";
  }

  if (toInput) {
    toInput.value = "";
  }

  if (reasonInput) {
    reasonInput.value = "";
  }

  workingHoursStatus.hidden = true;
  renderBlockedDates();
}

document
  .getElementById(
    "addBlockedDateButton"
  )
  ?.addEventListener(
    "click",
    addBlockedDate
  );


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


    const publicRules =
      data.public_booking_rules ||
      {};


    document
      .getElementById(
        "settingsPublicBookingEnabled"
      )
      .checked =
        publicRules.enabled !== false;


    document
      .getElementById(
        "settingsMinimumNotice"
      )
      .value =
        String(
          publicRules.minimum_notice_hours ??
          2
        );


    document
      .getElementById(
        "settingsMaxAdvanceDays"
      )
      .value =
        String(
          publicRules.max_advance_days ??
          90
        );


    blockedDatesState =
      normaliseBlockedDates(
        publicRules.blocked_dates
      );


    renderBlockedDates();


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

      public_booking_enabled:
        document
          .getElementById(
            "settingsPublicBookingEnabled"
          )
          .checked,

      public_booking_minimum_notice_hours:
        Number(
          document
            .getElementById(
              "settingsMinimumNotice"
            )
            .value
        ),

      public_booking_max_advance_days:
        Number(
          document
            .getElementById(
              "settingsMaxAdvanceDays"
            )
            .value
        ),

      blocked_dates:
        blockedDatesState,

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


/* =======================================================
   Notification settings
   ======================================================= */

const notificationSettingsForm =
  document.getElementById(
    "notificationSettingsForm"
  );

const notificationSettingsStatus =
  document.getElementById(
    "notificationSettingsStatus"
  );

async function loadNotificationSettings() {
  if (!notificationSettingsForm) {
    return;
  }

  notificationSettingsStatus.hidden =
    true;

  try {
    const response =
      await fetch(
        "/api/settings/notifications",
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
        "Unable to load notification settings."
      );
    }

    const settings =
      data.settings ||
      {};

    document
      .getElementById(
        "notifyBookingConfirmation"
      )
      .checked =
        settings
          .booking_confirmation_enabled !==
        false;

    document
      .getElementById(
        "notifyReminders"
      )
      .checked =
        settings.reminder_enabled !==
        false;

    document
      .getElementById(
        "notifyCancellation"
      )
      .checked =
        settings.cancellation_enabled !==
        false;

    document
      .getElementById(
        "notifyReschedule"
      )
      .checked =
        settings.reschedule_enabled !==
        false;

    document
      .getElementById(
        "notifyReminderHours"
      )
      .value =
        String(
          settings.reminder_hours_before ||
          24
        );


    document
      .getElementById(
        "notifyFormReminders"
      )
      .checked =
        settings
          .form_reminder_enabled !==
        false;

    document
      .getElementById(
        "notifyPaymentReceipts"
      )
      .checked =
        settings
          .payment_receipt_enabled !==
        false;

    document
      .getElementById(
        "notifyFormReminderHours"
      )
      .value =
        String(
          settings
            .form_reminder_hours_after ||
          48
        );
  } catch (error) {
    notificationSettingsStatus.hidden =
      false;

    notificationSettingsStatus.className =
      "es-status error";

    notificationSettingsStatus.textContent =
      error.message ||
      "Unable to load notification settings.";
  }
}

notificationSettingsForm
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const button =
        document.getElementById(
          "saveNotificationSettingsButton"
        );

      button.disabled = true;

      notificationSettingsStatus.hidden =
        false;

      notificationSettingsStatus.className =
        "es-status";

      notificationSettingsStatus.textContent =
        "Saving notification settings…";

      try {
        const response =
          await fetch(
            "/api/settings/notifications",
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
                  booking_confirmation_enabled:
                    document
                      .getElementById(
                        "notifyBookingConfirmation"
                      )
                      .checked,

                  reminder_enabled:
                    document
                      .getElementById(
                        "notifyReminders"
                      )
                      .checked,

                  reminder_hours_before:
                    Number(
                      document
                        .getElementById(
                          "notifyReminderHours"
                        )
                        .value
                    ),

                  cancellation_enabled:
                    document
                      .getElementById(
                        "notifyCancellation"
                      )
                      .checked,

                  reschedule_enabled:
                    document
                      .getElementById(
                        "notifyReschedule"
                      )
                      .checked,

                  form_reminder_enabled:
                    document
                      .getElementById(
                        "notifyFormReminders"
                      )
                      .checked,

                  form_reminder_hours_after:
                    Number(
                      document
                        .getElementById(
                          "notifyFormReminderHours"
                        )
                        .value
                    ),

                  payment_receipt_enabled:
                    document
                      .getElementById(
                        "notifyPaymentReceipts"
                      )
                      .checked
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
            "Unable to save notification settings."
          );
        }

        notificationSettingsStatus.className =
          "es-status success";

        notificationSettingsStatus.textContent =
          "Notification settings saved.";
      } catch (error) {
        notificationSettingsStatus.className =
          "es-status error";

        notificationSettingsStatus.textContent =
          error.message ||
          "Unable to save notification settings.";
      } finally {
        button.disabled = false;
      }
    }
  );


/* =======================================================
   Page startup
   Run this only after every settings module above has
   initialised its DOM references and handlers.
   ======================================================= */

loadTabFromHash();
loadSettings();
