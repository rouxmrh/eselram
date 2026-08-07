const form = document.getElementById("brandingForm");
const statusBox = document.getElementById("formStatus");
const continueButton = document.getElementById("continueButton");

const primaryColour = document.getElementById("primaryColour");
const primaryColourText = document.getElementById("primaryColourText");

const accentColour = document.getElementById("accentColour");
const accentColourText = document.getElementById("accentColourText");

function isValidHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

primaryColour.addEventListener("input", () => {
  primaryColourText.value = primaryColour.value;
});

accentColour.addEventListener("input", () => {
  accentColourText.value = accentColour.value;
});

primaryColourText.addEventListener("input", () => {
  const value = primaryColourText.value.trim();

  if (isValidHex(value)) {
    primaryColour.value = value;
  }
});

accentColourText.addEventListener("input", () => {
  const value = accentColourText.value.trim();

  if (isValidHex(value)) {
    accentColour.value = value;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const primary = primaryColourText.value.trim();
  const accent = accentColourText.value.trim();

  if (!isValidHex(primary) || !isValidHex(accent)) {
    statusBox.hidden = false;
    statusBox.className = "es-status error";
    statusBox.textContent = "Please enter valid 6-digit hex colours.";
    return;
  }

  statusBox.hidden = false;
  statusBox.className = "es-status";
  statusBox.textContent = "Saving your branding preferences…";

  continueButton.disabled = true;

  const payload = {
    primary_colour: primary,
    accent_colour: accent,
    theme: document.getElementById("theme").value,
    time_format: document.getElementById("timeFormat").value,
    date_format: document.getElementById("dateFormat").value
  };

  try {
    const response = await fetch("/api/install/branding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Unable to save branding preferences."
      );
    }

    statusBox.classList.add("success");
    statusBox.textContent = "Branding saved.";

    window.location.href = "/installer/payments.html";

  } catch (error) {
    console.error(error);

    statusBox.classList.add("error");
    statusBox.textContent =
      error.message || "Something went wrong.";

    continueButton.disabled = false;
  }
});
