import { renderSidebar } from "/components/sidebar.js?v=20260821-mobile-nav-v2";
renderSidebar("analytics");

let bookingUrl = "";
const statusBox = document.getElementById("analyticsStatus");
const generated = document.getElementById("generatedLink");

function showStatus(message, isError = false) {
  statusBox.hidden = false;
  statusBox.textContent = message;
  statusBox.classList.toggle("is-error", isError);
}

function slug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

function trackedUrl(source, medium, campaign) {
  const url = new URL(bookingUrl);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

async function copy(text) {
  await navigator.clipboard.writeText(text);
  showStatus("Tracking link copied.");
}

async function loadBookingUrl() {
  try {
    const response = await fetch("/api/setup-health", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data?.environment?.public_booking_url) throw new Error("Booking link unavailable.");
    bookingUrl = data.environment.public_booking_url;
  } catch (error) {
    document.querySelectorAll("[data-source]").forEach(button => button.disabled = true);
    document.getElementById("createCampaignLink").disabled = true;
    showStatus("Unable to load your public booking link. Check Setup Health and try again.", true);
  }
}

document.querySelectorAll("[data-source]").forEach(button => {
  button.addEventListener("click", async () => {
    if (!bookingUrl) return;
    await copy(trackedUrl(button.dataset.source, button.dataset.medium, button.dataset.campaign));
  });
});

document.getElementById("createCampaignLink").addEventListener("click", () => {
  if (!bookingUrl) return;
  const name = slug(document.getElementById("campaignName").value);
  const source = document.getElementById("campaignSource").value;
  if (!name) return showStatus("Enter a campaign name first.", true);
  const medium = ["instagram", "facebook"].includes(source) ? "social" : source === "website" ? "referral" : source === "google" ? "campaign" : source;
  const url = trackedUrl(source, medium, name);
  generated.hidden = false;
  generated.innerHTML = `<strong>Your tracking link</strong><br><span>${url.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</span><div class="es-form-actions"><button id="copyGeneratedLink" class="es-secondary-button" type="button">Copy link</button></div>`;
  document.getElementById("copyGeneratedLink").addEventListener("click", () => copy(url));
  statusBox.hidden = true;
});

document.querySelectorAll(".es-analytics-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".es-analytics-tab").forEach(x => x.classList.toggle("active", x === tab));
    const tracking = tab.dataset.panel === "tracking";
    document.getElementById("panel-tracking").hidden = !tracking;
    document.getElementById("panel-placeholder").hidden = tracking;
  });
});

loadBookingUrl();
