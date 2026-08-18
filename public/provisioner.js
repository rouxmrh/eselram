const providerButtons = {
  cloudflare: document.getElementById("cloudflareButton"),
  github: document.getElementById("githubButton"),
  resend: document.getElementById("resendButton"),
  stripe: document.getElementById("stripeButton")
};

const installButton = document.getElementById("installButton");
const progressCard = document.getElementById("progressCard");
const progressList = document.getElementById("progressList");
const progressNotice = document.getElementById("progressNotice");
const accountNotice = document.getElementById("accountNotice");
const completeActions = document.getElementById("completeActions");
const continueButton = document.getElementById("continueButton");

const STEP_LABELS = {
  database: "Creating database",
  storage: "Preparing file storage",
  security: "Configuring security",
  email: "Preparing email",
  repository: "Creating your GitHub copy",
  application: "Setting up application",
  migrations: "Preparing database",
  payments: "Connecting payments",
  verify: "Verifying installation"
};

function paymentMode() {
  return document.querySelector('input[name="paymentMode"]:checked')?.value || "manual";
}

function updatePaymentUi() {
  providerButtons.stripe.classList.toggle("hidden", paymentMode() !== "stripe");
  refresh();
}

document.querySelectorAll('input[name="paymentMode"]').forEach((input) => {
  input.addEventListener("change", updatePaymentUi);
});

function providerLabel(provider) {
  if (provider === "resend") return "Email connected";
  if (provider === "stripe") return "Stripe connected";
  return `${provider[0].toUpperCase()}${provider.slice(1)} connected`;
}

function setProviderState(provider, connected, available = true) {
  const button = providerButtons[provider];
  if (!button) return;
  if (!available) {
    button.textContent = "Not configured";
    button.removeAttribute("href");
    button.setAttribute("aria-disabled", "true");
    return;
  }
  if (connected) {
    button.textContent = providerLabel(provider);
    button.classList.add("secondary");
    button.removeAttribute("href");
    button.setAttribute("aria-disabled", "true");
  }
}

function renderSteps(steps = {}) {
  progressList.innerHTML = Object.entries(STEP_LABELS).map(([key, label]) => {
    const step = steps[key] || { status: "pending", message: "" };
    const klass = step.status === "complete" ? "done" : step.status === "running" ? "running" : step.status === "error" ? "error" : "";
    const icon = step.status === "complete" ? "✓" : step.status === "error" ? "!" : step.status === "running" ? "•" : "";
    return `<div class="step ${klass}"><span class="dot">${icon}</span><div><strong>${label}</strong>${step.message ? `<div class="step-message">${escapeHtml(step.message)}</div>` : ""}</div><span class="status">${escapeHtml(step.status || "pending")}</span></div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

async function refresh() {
  try {
    const response = await fetch("/api/status", { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to read installation status.");

    setProviderState("cloudflare", !!data.providers.cloudflare.connected, !!data.providers.cloudflare.available);
    setProviderState("github", !!data.providers.github.connected, !!data.providers.github.available);
    setProviderState("resend", !!data.providers.resend.connected, !!data.providers.resend.available);
    setProviderState("stripe", !!data.providers.stripe.connected, !!data.providers.stripe.available);

    if (data.cloudflare_accounts?.length > 1 && !data.selected_cloudflare_account_id) {
      accountNotice.classList.remove("hidden");
      accountNotice.innerHTML = `Cloudflare has more than one account. Choose where Eselram should be installed: <select id="cfAccountSelect"><option value="">Choose account</option>${data.cloudflare_accounts.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("")}</select>`;
      document.getElementById("cfAccountSelect")?.addEventListener("change", async (event) => {
        if (!event.target.value) return;
        await fetch("/api/cloudflare/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: event.target.value }) });
        refresh();
      });
    } else {
      accountNotice.classList.add("hidden");
    }

    const stripeNeeded = paymentMode() === "stripe";
    const ready = data.providers.cloudflare.connected && data.providers.github.connected && data.providers.resend.connected && (!stripeNeeded || data.providers.stripe.connected) && (!!data.selected_cloudflare_account_id || data.cloudflare_accounts?.length === 1);
    const installLocked = ["running", "deploying", "complete", "error", "blocked"].includes(data.session.status);
    installButton.disabled = !ready || installLocked;
    if (data.session.status === "deploying") installButton.textContent = "Deploying Eselram…";
    else if (data.session.status === "complete") installButton.textContent = "Eselram installed";
    else if (["error", "blocked"].includes(data.session.status)) installButton.textContent = "Installation stopped";
    else installButton.textContent = "Install Eselram";

    if (data.session.status !== "connecting") {
      progressCard.classList.remove("hidden");
      renderSteps(data.steps);
    }

    if (data.session.status === "complete" && data.session.installation_url) {
      completeActions.classList.remove("hidden");
      continueButton.href = data.session.installation_url;
      progressNotice.classList.add("hidden");
    } else if (data.session.status === "deploying") {
      progressNotice.classList.remove("hidden", "error");
      progressNotice.classList.remove("error");
      progressNotice.textContent = data.session.message || "Cloudflare is deploying your Eselram application.";
    } else if (data.session.status === "blocked") {
      progressNotice.classList.remove("hidden");
      progressNotice.textContent = data.session.message || "The installation needs one more deployment step before it can complete.";
    } else if (data.session.status === "error") {
      progressNotice.classList.remove("hidden", "error");
      progressNotice.classList.add("error");
      progressNotice.textContent = data.session.message || "Installation could not complete.";
    }
  } catch (error) {
    accountNotice.classList.remove("hidden");
    accountNotice.classList.add("error");
    accountNotice.textContent = error.message;
  }
}

installButton.addEventListener("click", async () => {
  installButton.disabled = true;
  progressCard.classList.remove("hidden");
  progressNotice.classList.add("hidden");
  try {
    const response = await fetch("/api/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_mode: paymentMode() }) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to start installation.");
  } catch (error) {
    progressNotice.classList.remove("hidden");
    progressNotice.classList.add("error");
    progressNotice.textContent = error.message;
  }
  await refresh();
});

updatePaymentUi();
setInterval(refresh, 2500);
