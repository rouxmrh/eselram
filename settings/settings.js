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

const updatesPanel =
  document.getElementById(
    "tab-updates"
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


async function loadUpdateInformation() {
  const versionNode = document.getElementById("installedEselramVersion");
  const messageNode = document.getElementById("updateVersionMessage");
  const statusNode = document.getElementById("updatesStatus");
  const titleNode = document.getElementById("availableUpdateTitle");
  const availableMessageNode = document.getElementById("availableUpdateMessage");
  const checkButton = document.getElementById("checkForUpdatesButton");
  const updateButton = document.getElementById("openSecureUpdaterButton");

  if (!versionNode || !messageNode) return;

  let localVersion = "";
  try {
    const response = await fetch("/eselram-version.json", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      localVersion = String(data?.version || "").trim();
    }
  } catch {}

  if (localVersion) {
    versionNode.textContent = localVersion;
    messageNode.textContent = `Eselram ${localVersion} is installed on this business.`;
  } else {
    versionNode.textContent = "Release information unavailable";
    messageNode.textContent = "Version reporting becomes available after the next protected Eselram release is installed.";
  }

  if (checkButton) checkButton.disabled = true;
  if (updateButton) updateButton.hidden = true;
  if (titleNode) titleNode.textContent = "Checking for updates";
  if (availableMessageNode) availableMessageNode.textContent = "Checking your licence and the latest protected Eselram release.";
  if (statusNode) statusNode.hidden = true;

  try {
    const response = await fetch("/api/updates/status", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || "Unable to check for updates.");

    const installed = String(data.installed_version || localVersion || "").trim();
    const available = String(data.available_version || installed || "").trim();
    if (installed) {
      versionNode.textContent = installed;
      messageNode.textContent = `Eselram ${installed} is installed on this business.`;
    }

    if (data.update_available === true && available) {
      if (titleNode) titleNode.textContent = `Eselram ${available} is available`;
      if (availableMessageNode) {
        const notes = String(data.release_notes || "").trim();
        availableMessageNode.textContent = notes || "A protected Eselram update is ready for this installation.";
      }
      if (updateButton) {
        updateButton.hidden = false;
        updateButton.textContent = `Update to ${available}`;
        updateButton.dataset.targetVersion = available;
      }
    } else {
      if (titleNode) titleNode.textContent = "Eselram is up to date";
      if (availableMessageNode) availableMessageNode.textContent = installed ? `You're running the latest protected release, Eselram ${installed}.` : "This installation is on the latest protected release.";
    }
  } catch (error) {
    if (titleNode) titleNode.textContent = "Secure updates not ready yet";
    if (availableMessageNode) availableMessageNode.textContent = error.message || "Unable to check for updates right now.";
    if (statusNode) {
      statusNode.className = "es-status error";
      statusNode.textContent = error.message || "Unable to check for updates.";
      statusNode.hidden = false;
    }
  } finally {
    if (checkButton) checkButton.disabled = false;
  }
}

async function openSecureUpdater() {
  const button = document.getElementById("openSecureUpdaterButton");
  const statusNode = document.getElementById("updatesStatus");
  if (!button) return;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Preparing secure update…";
  if (statusNode) statusNode.hidden = true;

  try {
    const response = await fetch("/api/updates/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || "Unable to open the secure updater.");
    if (!data?.updater_url) throw new Error("The secure updater did not return a handoff link.");
    window.location.href = data.updater_url;
  } catch (error) {
    if (statusNode) {
      statusNode.className = "es-status error";
      statusNode.textContent = error.message || "Unable to open the secure updater.";
      statusNode.hidden = false;
    }
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.getElementById("checkForUpdatesButton")?.addEventListener("click", loadUpdateInformation);
document.getElementById("openSecureUpdaterButton")?.addEventListener("click", openSecureUpdater);


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
  updatesPanel.hidden = true;
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

    loadEmailProviderChoice()
      .then(() => loadEmailIntegration())
      .catch((error) => {
        console.error("Unable to load email provider settings:", error);
      });

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

  if (tab === "updates") {

    updatesPanel.hidden = false;

    loadUpdateInformation();

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

const manualPaymentAvailability =
  document.getElementById(
    "manualPaymentAvailability"
  );

const stripePaymentAvailability =
  document.getElementById(
    "stripePaymentAvailability"
  );

const paymentDefaultProvider =
  document.getElementById(
    "paymentDefaultProvider"
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

const makeManualDefaultButton =
  document.getElementById(
    "makeManualDefaultButton"
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
        integration.is_default ===
        true;


    stripeSecretKeyHelp.textContent =
      integration.provisioned_connection
        ? "Stripe was connected during Eselram installation. The credential is stored securely; you do not need to paste a key."
        : integration.has_secret_key
          ? "A Stripe server-side key is already stored securely. Leave this blank to keep the existing key."
          : "Stripe was not connected during this installation. You can configure it here with a business-owned key.";


    stripeWebhookSecretHelp.textContent =
      integration.has_webhook_secret
        ? "A webhook signing secret is already stored securely. Leave this blank to keep it."
        : "Optional at this stage. Add it when the Stripe webhook endpoint is enabled.";


    const labels = {
      not_configured: "Not configured",
      configured: "Configured — test required",
      verified: "Connected",
      error: "Connection needs attention",
      disabled: "Disabled"
    };


    stripeIntegrationStatus.textContent =
      integration.provisioned_connection ||
      integration.connection_status ===
        "connected"
        ? "Connected"
        : (
            labels[
              integration.status
            ] ||
            integration.status ||
            "Not configured"
          );


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


    if (manualPaymentAvailability) {
      manualPaymentAvailability.textContent =
        integration.manual_enabled
          ? "✓ Pay in person"
          : "Pay in person unavailable";
      manualPaymentAvailability.classList.toggle(
        "is-muted",
        integration.manual_enabled !== true
      );
    }

    if (stripePaymentAvailability) {
      const stripeAvailable =
        integration.provisioned_connection ||
        integration.connection_status === "connected" ||
        integration.status === "verified";

      stripePaymentAvailability.textContent =
        stripeAvailable
          ? "✓ Stripe"
          : "· Stripe not connected";

      stripePaymentAvailability.classList.toggle(
        "is-muted",
        !stripeAvailable
      );
    }

    if (paymentDefaultProvider) {
      paymentDefaultProvider.textContent =
        integration.default_provider === "manual"
          ? "Pay in person"
          : integration.default_provider === "stripe"
            ? "Stripe"
            : "Not selected";
    }

    if (makeManualDefaultButton) {
      makeManualDefaultButton.disabled =
        integration.default_provider === "manual";
      makeManualDefaultButton.textContent =
        integration.default_provider === "manual"
          ? "Pay in person is default"
          : "Use Pay in person as default";
    }


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




makeManualDefaultButton
  ?.addEventListener(
    "click",
    async () => {
      makeManualDefaultButton.disabled = true;
      stripeIntegrationMessage.hidden = false;
      stripeIntegrationMessage.className = "es-status";
      stripeIntegrationMessage.textContent = "Setting Pay in person as default…";

      try {
        const response = await fetch(
          "/api/integrations/payments/stripe",
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({ default_provider: "manual" })
          }
        );
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Unable to change the default payment method.");
        }
        stripeIntegrationMessage.className = "es-status success";
        stripeIntegrationMessage.textContent = "Pay in person is now the default payment method. Stripe remains optional.";
        await loadStripeIntegration();
      } catch (error) {
        stripeIntegrationMessage.className = "es-status error";
        stripeIntegrationMessage.textContent = error.message || "Unable to change the default payment method.";
        makeManualDefaultButton.disabled = false;
      }
    }
  );


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

const activeEmailProviderLabel =
  document.getElementById("activeEmailProviderLabel");

const gmailProviderCard =
  document.getElementById("gmailProviderCard");

const resendProviderCard =
  document.getElementById("resendProviderCard");

const resendProviderState =
  document.getElementById("resendProviderState");

const gmailConnectedAccount =
  document.getElementById("gmailConnectedAccount");

const connectGmailButton =
  document.getElementById("connectGmailButton");

const useGmailButton =
  document.getElementById("useGmailButton");

const disconnectGmailButton =
  document.getElementById("disconnectGmailButton");

const useResendButton =
  document.getElementById("useResendButton");

const resendSettingsSection =
  document.getElementById("resendSettingsSection");



const emailSendingDomain =
  document.getElementById(
    "emailSendingDomain"
  );

const createEmailDomainButton =
  document.getElementById(
    "createEmailDomainButton"
  );

const verifyEmailDomainButton =
  document.getElementById(
    "verifyEmailDomainButton"
  );

const emailDomainStatus =
  document.getElementById(
    "emailDomainStatus"
  );

const emailDnsRecordsWrap =
  document.getElementById(
    "emailDnsRecordsWrap"
  );

const emailDnsRecords =
  document.getElementById(
    "emailDnsRecords"
  );

const emailDomainActions =
  document.getElementById(
    "emailDomainActions"
  );

const emailDnsProviderStep = document.getElementById("emailDnsProviderStep");
const emailDnsProviderGuide = document.getElementById("emailDnsProviderGuide");
const emailDnsProviderGrid = document.getElementById("emailDnsProviderGrid");
let selectedDnsProvider = "";
let currentEmailDnsRecords = [];




async function setEmailProvider(provider) {
  const response = await fetch(
    "/api/integrations/email/provider",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ provider })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error ||
      "Unable to change the email provider."
    );
  }

  await loadEmailProviderChoice();
}

async function loadEmailProviderChoice() {
  try {
    const [providerResponse, gmailResponse] =
      await Promise.all([
        fetch(
          "/api/integrations/email/provider",
          {
            headers: { Accept: "application/json" },
            cache: "no-store"
          }
        ),
        fetch(
          "/api/integrations/email/gmail",
          {
            headers: { Accept: "application/json" },
            cache: "no-store"
          }
        )
      ]);

    const providerData =
      await providerResponse.json();
    const gmailData =
      await gmailResponse.json();

    const active =
      providerData?.active_provider ||
      "resend";

    const gmail =
      gmailData?.gmail || {};

    if (gmail.migration_required) {
      if (gmailConnectedAccount) {
        gmailConnectedAccount.textContent =
          "Gmail update pending";
      }

      if (connectGmailButton) {
        connectGmailButton.hidden = true;
      }

      if (useGmailButton) {
        useGmailButton.hidden = true;
      }

      if (disconnectGmailButton) {
        disconnectGmailButton.hidden = true;
      }

      if (emailIntegrationMessage) {
        emailIntegrationMessage.hidden = false;
        emailIntegrationMessage.className = "es-status";
        emailIntegrationMessage.textContent =
          "Gmail support has been added to Eselram, but this existing installation still needs database migration 036. New installations will receive it automatically.";
      }
    }

    if (activeEmailProviderLabel) {
      activeEmailProviderLabel.textContent =
        active === "gmail"
          ? "Gmail"
          : "Resend";
    }

    gmailProviderCard?.classList.toggle(
      "is-active",
      active === "gmail"
    );

    resendProviderCard?.classList.toggle(
      "is-active",
      active === "resend"
    );

    if (gmailConnectedAccount) {
      gmailConnectedAccount.textContent =
        gmail.connected
          ? `Connected as ${gmail.email}`
          : "Not connected";
    }

    if (connectGmailButton) {
      connectGmailButton.hidden =
        Boolean(gmail.connected) ||
        Boolean(gmail.migration_required);
    }

    if (useGmailButton) {
      useGmailButton.hidden =
        !gmail.connected ||
        active === "gmail";
    }

    if (disconnectGmailButton) {
      disconnectGmailButton.hidden =
        !gmail.connected;
    }

    if (useResendButton) {
      useResendButton.hidden =
        active === "resend";
    }

    if (resendSettingsSection) {
      // Keep Resend configuration visible even when Gmail is active so a
      // business can prepare a branded domain before switching later.
      resendSettingsSection.hidden = false;
    }

    if (
      emailIntegrationStatus &&
      active === "gmail" &&
      gmail.connected
    ) {
      emailIntegrationStatus.textContent =
        "Gmail ready";
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("gmail") === "connected" &&
      emailIntegrationMessage
    ) {
      emailIntegrationMessage.hidden = false;
      emailIntegrationMessage.className =
        "es-status success";
      emailIntegrationMessage.textContent =
        "Gmail connected. Eselram can now send client emails directly from this Gmail account without a business domain.";
      history.replaceState(
        {},
        "",
        `${window.location.pathname}#email`
      );
    }

    if (
      params.get("gmail") === "error" &&
      emailIntegrationMessage
    ) {
      emailIntegrationMessage.hidden = false;
      emailIntegrationMessage.className =
        "es-status error";
      emailIntegrationMessage.textContent =
        "Gmail could not be connected. Try again and approve the Gmail send permission.";
    }
  } catch (error) {
    console.error(
      "Unable to load email provider choice:",
      error
    );
  }
}

useGmailButton
  ?.addEventListener(
    "click",
    async () => {
      try {
        await setEmailProvider("gmail");
      } catch (error) {
        emailIntegrationMessage.hidden = false;
        emailIntegrationMessage.className =
          "es-status error";
        emailIntegrationMessage.textContent =
          error.message;
      }
    }
  );

useResendButton
  ?.addEventListener(
    "click",
    async () => {
      try {
        await setEmailProvider("resend");
        await loadEmailIntegration();
      } catch (error) {
        emailIntegrationMessage.hidden = false;
        emailIntegrationMessage.className =
          "es-status error";
        emailIntegrationMessage.textContent =
          error.message;
      }
    }
  );

disconnectGmailButton
  ?.addEventListener(
    "click",
    async () => {
      if (
        !confirm(
          "Disconnect Gmail from Eselram?"
        )
      ) {
        return;
      }

      const response = await fetch(
        "/api/integrations/email/gmail",
        {
          method: "DELETE",
          headers: { Accept: "application/json" }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        emailIntegrationMessage.hidden = false;
        emailIntegrationMessage.className =
          "es-status error";
        emailIntegrationMessage.textContent =
          data.error ||
          "Unable to disconnect Gmail.";
        return;
      }

      await loadEmailProviderChoice();
      await loadEmailIntegration();
    }
  );


function clearNode(node) {
  while (node?.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function dnsRecordCell(label, value) {
  const wrap =
    document.createElement("div");

  const span =
    document.createElement("span");

  const strong =
    document.createElement("strong");

  span.textContent =
    label;

  strong.textContent =
    value || "—";

  if (label === "Value") {
    strong.style.wordBreak =
      "break-all";
  }

  wrap.appendChild(span);
  wrap.appendChild(strong);

  return wrap;
}

function dnsRecordValue(record) {
  return String(record.value || record.content || "");
}

function renderEmailDnsRecords(records = []) {
  if (!emailDnsRecords || !emailDnsRecordsWrap) return;
  const list = Array.isArray(records) ? records : [];
  currentEmailDnsRecords = list;
  clearNode(emailDnsRecords);
  if (!list.length) { emailDnsRecordsWrap.hidden = true; return; }

  for (const record of list) {
    const row = document.createElement("div");
    row.className = "es-dns-record-row";
    const grid = document.createElement("div");
    grid.className = "es-dns-record-grid";
    const type = document.createElement("span");
    type.textContent = String(record.type || record.record_type || "DNS");
    const value = document.createElement("strong");
    const name = String(record.name || record.host || "");
    const content = dnsRecordValue(record);
    value.textContent = `${name} → ${content}`;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "es-secondary-button es-copy-dns";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(content); copy.textContent = "Copied ✓"; setTimeout(() => copy.textContent = "Copy", 1500); }
      catch { copy.textContent = "Select value"; }
    });
    grid.append(type, value, copy);
    row.appendChild(grid);
    emailDnsRecords.appendChild(row);
  }
  emailDnsRecordsWrap.hidden = false;
}

const DNS_PROVIDER_GUIDES = {
  cloudflare: { name:"Cloudflare", url:"https://dash.cloudflare.com/", text:"Open your domain in Cloudflare, choose DNS → Records, then add the records shown under Advanced below. Leave TTL on Auto. Eselram will check the domain for you afterwards." },
  godaddy: { name:"GoDaddy", url:"https://dcc.godaddy.com/control/portfolio", text:"Open your domain, choose DNS, then Add New Record for each record shown under Advanced below. Save each one, then return here." },
  ionos: { name:"IONOS", url:"https://my.ionos.co.uk/", text:"Open Domains & SSL, select your domain, then DNS. Add the records shown under Advanced below and save them." },
  wix: { name:"Wix", url:"https://manage.wix.com/", text:"Open Domains, select your domain, choose Advanced → Manage DNS Records, then add the records shown under Advanced below." },
  squarespace: { name:"Squarespace", url:"https://account.squarespace.com/", text:"Open Domains, select your domain, choose DNS Settings, then add the records shown under Advanced below." },
  other: { name:"your domain provider", url:"", text:"Open the DNS settings where your domain is managed. Add the records shown under Advanced below, save them, then return to Eselram." }
};

function showDnsProviderGuide(provider) {
  selectedDnsProvider = provider;
  if (!emailDnsProviderGuide) return;
  document.querySelectorAll(".es-dns-provider").forEach(btn => btn.classList.toggle("is-selected", btn.dataset.dnsProvider === provider));
  const guide = DNS_PROVIDER_GUIDES[provider] || DNS_PROVIDER_GUIDES.other;
  clearNode(emailDnsProviderGuide);
  const strong = document.createElement("strong");
  strong.textContent = `Set up with ${guide.name}`;
  const p = document.createElement("p"); p.textContent = guide.text; p.style.margin = "0";
  emailDnsProviderGuide.append(strong, p);
  if (guide.url) { const a=document.createElement("a"); a.href=guide.url; a.target="_blank"; a.rel="noopener noreferrer"; a.textContent=`Open ${guide.name}`; a.style.display="inline-block"; a.style.marginTop="10px"; emailDnsProviderGuide.appendChild(a); }
  emailDnsProviderGuide.hidden = false;
}

emailDnsProviderGrid?.addEventListener("click", event => {
  const button = event.target.closest("[data-dns-provider]");
  if (button) showDnsProviderGuide(button.dataset.dnsProvider);
});

function normaliseEmailDomainInput(value) {
  let domain =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!domain) {
    return "";
  }

  try {
    const candidate =
      /^[a-z][a-z0-9+.-]*:\/\//i.test(domain)
        ? domain
        : `https://${domain}`;

    const parsed =
      new URL(candidate);

    domain =
      parsed.hostname || domain;
  } catch {
    domain =
      domain
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0];
  }

  return domain
    .replace(/^www\./i, "")
    .replace(/\.$/, "")
    .trim();
}

function cleanEmailDomainField() {
  if (!emailSendingDomain) {
    return "";
  }

  const cleaned =
    normaliseEmailDomainInput(
      emailSendingDomain.value
    );

  emailSendingDomain.value =
    cleaned;

  return cleaned;
}

emailSendingDomain
  ?.addEventListener(
    "blur",
    cleanEmailDomainField
  );

emailSendingDomain
  ?.addEventListener(
    "change",
    cleanEmailDomainField
  );


async function loadEmailDomain() {
  if (!emailDomainStatus) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/integrations/email/domain",
        {
          headers: {
            Accept:
              "application/json"
          },
          cache:
            "no-store"
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
        "Unable to load sending-domain setup."
      );
    }

    const domain =
      data.domain || {};

    const sendingInput =
      document.getElementById(
        "emailFromEmail"
      );

    if (emailSendingDomain) {
      emailSendingDomain.value =
        domain.domain_name ||
        "";
    }

    if (
      !domain.automation_available
    ) {
      emailDomainStatus.hidden =
        false;

      emailDomainStatus.className =
        "es-status";

      emailDomainStatus.textContent =
        "This existing test installation was created before guided domain setup was enabled. Add and verify the domain in Resend manually for this test copy. New installations will complete this flow inside Eselram.";

      emailDomainActions.hidden =
        false;

      createEmailDomainButton.disabled =
        true;

      renderEmailDnsRecords([]);

      if (sendingInput) {
        sendingInput.readOnly =
          false;
      }

      return;
    }

    if (!domain.configured) {
      emailDomainStatus.hidden =
        false;

      emailDomainStatus.className =
        "es-status";

      emailDomainStatus.textContent =
        "Automated emails are not active yet. Add a sending domain when you are ready, or continue using Eselram without one.";

      emailDomainActions.hidden =
        true;

      renderEmailDnsRecords([]);

      if (sendingInput) {
        sendingInput.value =
          "";

        sendingInput.readOnly =
          true;
      }

      return;
    }

    emailDomainActions.hidden = false;
    if (emailDnsProviderStep) emailDnsProviderStep.hidden = false;

    renderEmailDnsRecords(
      domain.records || []
    );

    if (domain.verified) {
      emailDomainStatus.hidden =
        false;

      emailDomainStatus.className =
        "es-status success";

      emailDomainStatus.textContent =
        `${domain.domain_name} is verified and ready for automated client emails.`;

      if (sendingInput) {
        sendingInput.value =
          domain.suggested_sending_email ||
          `notifications@${domain.domain_name}`;

        sendingInput.readOnly =
          false;
      }

      verifyEmailDomainButton.disabled =
        true;

      verifyEmailDomainButton.textContent =
        "Domain verified";

    } else {
      emailDomainStatus.hidden =
        false;

      emailDomainStatus.className =
        "es-status";

      emailDomainStatus.textContent =
        `${domain.domain_name} is ${domain.domain_status || "pending"}. Choose where your domain is managed, follow the simple steps, then click Check my domain.`;

      if (sendingInput) {
        sendingInput.value =
          "";

        sendingInput.readOnly =
          true;
      }

      verifyEmailDomainButton.disabled =
        false;

      verifyEmailDomainButton.textContent =
        "Check my domain";
    }

  } catch (error) {
    emailDomainStatus.hidden =
      false;

    emailDomainStatus.className =
      "es-status error";

    emailDomainStatus.textContent =
      error.message ||
      "Unable to load sending-domain setup.";
  }
}


createEmailDomainButton
  ?.addEventListener(
    "click",
    async () => {

      const domain =
        cleanEmailDomainField();

      if (!domain) {
        emailDomainStatus.hidden =
          false;

        emailDomainStatus.className =
          "es-status error";

        emailDomainStatus.textContent =
          "Enter the domain you own, for example yourclinic.co.uk.";

        return;
      }

      createEmailDomainButton.disabled =
        true;

      emailDomainStatus.hidden =
        false;

      emailDomainStatus.className =
        "es-status";

      emailDomainStatus.textContent =
        "Preparing your business domain…";

      try {
        const response =
          await fetch(
            "/api/integrations/email/domain",
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
                    "create",
                  domain
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
            "Unable to create the sending domain."
          );
        }

        await loadEmailDomain();
        await loadEmailIntegration();

      } catch (error) {
        emailDomainStatus.className =
          "es-status error";

        emailDomainStatus.textContent =
          error.message ||
          "Unable to create the sending domain.";

      } finally {
        createEmailDomainButton.disabled =
          false;
      }
    }
  );


verifyEmailDomainButton
  ?.addEventListener(
    "click",
    async () => {

      verifyEmailDomainButton.disabled =
        true;

      emailDomainStatus.hidden =
        false;

      emailDomainStatus.className =
        "es-status";

      emailDomainStatus.textContent =
        "Checking your domain…";

      try {
        const response =
          await fetch(
            "/api/integrations/email/domain",
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
                    "verify"
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
            "Unable to verify the sending domain."
          );
        }

        await loadEmailDomain();
        await loadEmailIntegration();

      } catch (error) {
        emailDomainStatus.className =
          "es-status error";

        emailDomainStatus.textContent =
          error.message ||
          "Unable to verify the sending domain.";

        verifyEmailDomainButton.disabled =
          false;
      }
    }
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


    const businessContact =
      integration.business_contact_email ||
      "";

    const businessName =
      integration.business_name ||
      "";

    const emailBusinessContact =
      document.getElementById(
        "emailBusinessContact"
      );

    if (emailBusinessContact) {
      emailBusinessContact.textContent =
        businessContact || "Not set";
    }

    document
      .getElementById(
        "emailFromName"
      )
      .value =
        integration.from_name ||
        businessName ||
        "";


    const loadedSendingEmail =
      integration.from_email || "";

    const personalSendingDomain =
      /@(gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|me\.com|yahoo\.com|yahoo\.co\.uk|aol\.com|proton\.me|protonmail\.com)$/i;

    document
      .getElementById(
        "emailFromEmail"
      )
      .value =
        personalSendingDomain.test(loadedSendingEmail)
          ? ""
          : loadedSendingEmail;


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
        "Resend not configured",
      configured:
        "Resend connected — domain not verified",
      verified:
        "Email sending ready",
      error:
        "Resend connected — sending not ready",
      disabled:
        "Resend disabled"
    };


    const gmailIsActive =
      String(activeEmailProviderLabel?.textContent || "")
        .trim()
        .toLowerCase() === "gmail";

    const gmailIsConnected =
      String(gmailConnectedAccount?.textContent || "")
        .trim()
        .toLowerCase()
        .startsWith("connected as ");

    emailIntegrationStatus.textContent =
      gmailIsActive
        ? (gmailIsConnected ? "Gmail ready" : "Gmail selected — connection required")
        : (
            statusLabels[
              integration.status
            ] ||
            integration.status ||
            "Not configured"
          );

    if (resendProviderState) {
      if (integration.status === "verified") {
        resendProviderState.textContent =
          "Resend ready to send";
      } else if (integration.has_api_key) {
        resendProviderState.textContent =
          "Resend account connected · sending domain not verified";
      } else {
        resendProviderState.textContent =
          "Resend not connected";
      }
    }


    disconnectEmailIntegrationButton.hidden =
      !integration.has_api_key;


    emailEncryptionWarning.hidden =
      data.encryption_ready;


    if (!data.encryption_ready) {

      emailEncryptionWarning.textContent =
        "This installation cannot save provider credentials until ESELRAM_ENCRYPTION_KEY is added as a Cloudflare secret.";
    }


    if (integration.last_error && !integration.sender_domain_required) {

      emailIntegrationMessage.hidden =
        false;

      emailIntegrationMessage.className =
        "es-status error";

      emailIntegrationMessage.textContent =
        integration.last_error;
    }

    await loadEmailDomain();


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

        const senderEmail =
          document
            .getElementById(
              "emailFromEmail"
            )
            .value
            .trim();

        const personalDomains =
          /@(gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|me\.com|yahoo\.com|yahoo\.co\.uk|aol\.com|proton\.me|protonmail\.com)$/i;

        if (senderEmail && personalDomains.test(senderEmail)) {
          throw new Error(
            "Keep your Gmail/Outlook address as the business contact/reply email. For automated sending, use an address on a domain verified in Resend — or leave Sending email blank until the domain is ready."
          );
        }


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
                    senderEmail,

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
          "Email settings saved. You can continue without a domain; automated client emails will activate after a sending domain is verified and tested.";


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


loadEmailProviderChoice();
