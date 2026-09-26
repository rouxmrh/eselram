const form = document.getElementById("businessForm");
const statusBox = document.getElementById("formStatus");

// Prefer the installer device's IANA timezone when it is one of the supported
// business zones. IANA zones automatically apply local daylight-saving rules.
try {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneSelect = document.getElementById("timezone");
  if (detectedTimezone && timezoneSelect?.querySelector(`option[value="${detectedTimezone}"]`)) {
    timezoneSelect.value = detectedTimezone;
  }
} catch {}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusBox.hidden = false;
  statusBox.className = "es-status";
  statusBox.textContent = "Saving your business details…";

  const payload = {
    name: document.getElementById("businessName").value.trim(),
    email: document.getElementById("businessEmail").value.trim(),
    phone: document.getElementById("businessPhone").value.trim(),
    country_code: document.getElementById("country").value,
    timezone: document.getElementById("timezone").value,
    currency: document.getElementById("currency").value
  };

  try {
    const response = await fetch("/api/install/business", {
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
        data.error || "Unable to save business details."
      );
    }

    statusBox.classList.add("success");
    statusBox.textContent = "Business details saved.";

    window.location.href = "/installer/hours.html";

  } catch (error) {
    console.error(error);

    statusBox.classList.add("error");
    statusBox.textContent =
      error.message || "Something went wrong.";
  }
});
