const form = document.getElementById("brandingForm");
const statusBox = document.getElementById("brandingStatus");
const saveButton = document.getElementById("saveBrandingButton");
const preview = document.getElementById("brandingPreview");
const previewLogo = document.getElementById("previewLogo");
const previewName = document.getElementById("previewBusinessName");

let logoDataUrl = "";
let businessName = "Your business";

const colourPairs = [
  ["primaryColour", "primaryColourPicker"],
  ["accentColour", "accentColourPicker"],
  ["backgroundColour", "backgroundColourPicker"],
  ["surfaceColour", "surfaceColourPicker"],
  ["textColour", "textColourPicker"]
];

for (const [textId, pickerId] of colourPairs) {
  const text = document.getElementById(textId);
  const picker = document.getElementById(pickerId);

  picker.addEventListener("input", () => {
    text.value = picker.value;
    updatePreview();
  });

  text.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(text.value.trim())) {
      picker.value = text.value.trim();
    }
    updatePreview();
  });
}

[
  "formStyle",
  "logoPosition",
  "showBusinessName",
  "showContactDetails",
  "footerText"
].forEach(id => {
  document.getElementById(id).addEventListener("change", updatePreview);
  document.getElementById(id).addEventListener("input", updatePreview);
});

document.getElementById("logoFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (file.size > 250 * 1024) {
    showStatus("Please use a logo smaller than 250 KB.", "error");
    event.target.value = "";
    return;
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    showStatus("Logo must be PNG, JPG or WEBP.", "error");
    event.target.value = "";
    return;
  }

  logoDataUrl = await readFileAsDataUrl(file);
  updatePreview();
});

document.getElementById("removeLogoButton").addEventListener("click", () => {
  logoDataUrl = "";
  document.getElementById("logoFile").value = "";
  updatePreview();
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function updatePreview() {
  preview.style.setProperty("--brand-primary", value("primaryColour"));
  preview.style.setProperty("--brand-accent", value("accentColour"));
  preview.style.setProperty("--brand-bg", value("backgroundColour"));
  preview.style.setProperty("--brand-surface", value("surfaceColour"));
  preview.style.setProperty("--brand-text", value("textColour"));

  previewName.textContent = businessName;
  previewName.hidden = !document.getElementById("showBusinessName").checked;

  if (logoDataUrl) {
    previewLogo.src = logoDataUrl;
    previewLogo.hidden = false;
    previewLogo.classList.toggle(
      "left",
      document.getElementById("logoPosition").value === "left"
    );
  } else {
    previewLogo.hidden = true;
    previewLogo.removeAttribute("src");
  }
}

function value(id) {
  return document.getElementById(id).value.trim();
}

function showStatus(message, type = "") {
  statusBox.hidden = false;
  statusBox.className = `es-status ${type}`.trim();
  statusBox.textContent = message;
}

async function loadBranding() {
  try {
    const response = await fetch("/api/branding", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (response.status === 401) {
      location.href = "/auth/login.html";
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load branding.");
    }

    businessName = data.business?.name || "Your business";

    const branding = data.branding || {};

    setValue("primaryColour", branding.primary_colour || "#365c50");
    setValue("accentColour", branding.accent_colour || "#6f8079");
    setValue("backgroundColour", branding.background_colour || "#f5f4ef");
    setValue("surfaceColour", branding.surface_colour || "#ffffff");
    setValue("textColour", branding.text_colour || "#18221f");

    for (const [textId, pickerId] of colourPairs) {
      document.getElementById(pickerId).value = value(textId);
    }

    document.getElementById("formStyle").value =
      branding.form_style || "soft";

    document.getElementById("logoPosition").value =
      branding.logo_position || "centre";

    document.getElementById("showBusinessName").checked =
      branding.show_business_name !== 0;

    document.getElementById("showContactDetails").checked =
      branding.show_contact_details !== 0;

    document.getElementById("footerText").value =
      branding.footer_text || "";

    logoDataUrl = branding.logo_data_url || "";

    updatePreview();
  } catch (error) {
    showStatus(error.message || "Unable to load branding.", "error");
  }
}

function setValue(id, newValue) {
  document.getElementById(id).value = newValue;
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const payload = {
    logo_data_url: logoDataUrl || null,
    primary_colour: value("primaryColour"),
    accent_colour: value("accentColour"),
    background_colour: value("backgroundColour"),
    surface_colour: value("surfaceColour"),
    text_colour: value("textColour"),
    form_style: value("formStyle"),
    logo_position: value("logoPosition"),
    show_business_name:
      document.getElementById("showBusinessName").checked ? 1 : 0,
    show_contact_details:
      document.getElementById("showContactDetails").checked ? 1 : 0,
    footer_text: value("footerText") || null
  };

  saveButton.disabled = true;
  showStatus("Saving branding…");

  try {
    const response = await fetch("/api/branding", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to save branding.");
    }

    showStatus("Branding saved.", "success");
  } catch (error) {
    showStatus(error.message || "Unable to save branding.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

loadBranding();
