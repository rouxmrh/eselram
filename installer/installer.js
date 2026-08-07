const statusBox =
  document.getElementById("systemStatus");

const getStartedButton =
  document.getElementById("getStartedButton");

async function checkInstallation() {
  try {
    const response =
      await fetch("/api/status", {
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

    if (!response.ok) {
      throw new Error(
        `Status request failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(
        data.error || "Unknown status error"
      );
    }

    if (data.installation_required) {
      statusBox.textContent =
        "Eselram is ready to be configured.";

      statusBox.classList.add("success");

      getStartedButton.hidden = false;

      return;
    }

    statusBox.textContent =
      `${data.business?.name || "This business"} is already configured.`;

    statusBox.classList.add("success");

  } catch (error) {
    console.error(error);

    statusBox.textContent =
      "Eselram could not connect to its database. Please check the system configuration.";

    statusBox.classList.add("error");
  }
}

getStartedButton.addEventListener(
  "click",
  () => {
    statusBox.textContent =
      "Database connection confirmed. Business setup is next.";
  }
);

checkInstallation();
