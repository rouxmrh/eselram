const $ = (selector) => document.querySelector(selector);

let templates = [];
let customerPackages = [];
let customers = [];
let services = [];
let currency = "GBP";
let activeView = "customers";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(minor) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency
    }).format(Number(minor || 0) / 100);
  } catch {
    return `£${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}

function shortDate(value) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function handleAuth(response) {
  if (response.status === 401) {
    location.href = "/auth/login.html";
    throw new Error("Authentication required.");
  }
}

async function load() {
  const response = await fetch("/api/packages", {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  handleAuth(response);

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to load packages.");
  }

  templates = data.templates || [];
  customerPackages = data.customer_packages || [];
  customers = data.customers || [];
  services = data.services || [];
  currency = data.currency || "GBP";

  render();
}

function render() {
  renderStats();
  renderTemplates();
  renderCustomerPackages();
  populateSelects();
}

function renderStats() {
  const active = customerPackages.filter(p => p.status === "active");
  $("#activePackageCount").textContent = active.length;

  $("#availableSessionCount").textContent =
    active.reduce(
      (total, item) => total + Number(item.sessions_available_to_book || 0),
      0
    );

  $("#packageOutstanding").textContent = money(
    active.reduce(
      (total, item) => total + Number(item.outstanding_minor || 0),
      0
    )
  );
}

function renderTemplates() {
  const wrap = $("#packageTemplatesList");

  if (!templates.length) {
    wrap.innerHTML = `
      <div class="es-empty-state" style="grid-column:1/-1;">
        <strong>No package templates yet.</strong>
        <span>Create a reusable package such as 6 sessions, a course of 3, or any other service bundle.</span>
      </div>
    `;
    return;
  }

  wrap.innerHTML = templates.map(item => `
    <article class="es-package-card">
      <div class="es-package-card-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <span>${escapeHtml(item.service_name)}</span>
        </div>
        <span class="es-package-status">${item.is_active ? "Active" : "Inactive"}</span>
      </div>

      <div class="es-package-meta">
        <span>${item.sessions_total} sessions</span>
        <span>${money(item.price_minor)}</span>
        ${Number(item.deposit_minor || 0) > 0
          ? `<span>${money(item.deposit_minor)} suggested deposit</span>`
          : ""}
        ${item.validity_days
          ? `<span>${item.validity_days} days validity</span>`
          : `<span>No expiry rule</span>`}
      </div>

      ${item.description
        ? `<p>${escapeHtml(item.description)}</p>`
        : ""}

      <div class="es-package-actions">
        <button
          class="es-secondary-button"
          type="button"
          data-edit-template="${escapeHtml(item.id)}"
        >
          Edit
        </button>
      </div>
    </article>
  `).join("");

  wrap.querySelectorAll("[data-edit-template]").forEach(button => {
    button.addEventListener("click", () => {
      const template = templates.find(
        item => item.id === button.dataset.editTemplate
      );
      if (template) openTemplateDialog(template);
    });
  });
}

function renderCustomerPackages() {
  const wrap = $("#customerPackagesList");

  if (!customerPackages.length) {
    wrap.innerHTML = `
      <div class="es-empty-state" style="grid-column:1/-1;">
        <strong>No customer packages yet.</strong>
        <span>Assign a package to a customer to start tracking sessions and package payments.</span>
      </div>
    `;
    return;
  }

  wrap.innerHTML = customerPackages.map(item => {
    const used = Number(item.sessions_completed || 0);
    const booked = Number(item.sessions_booked || 0);
    const total = Number(item.sessions_total || 0);
    const progress = total
      ? Math.min(100, Math.round((used / total) * 100))
      : 0;

    return `
      <article class="es-package-card">
        <div class="es-package-card-head">
          <div>
            <h3>${escapeHtml(item.name_snapshot)}</h3>
            <strong>${escapeHtml(`${item.first_name} ${item.last_name}`)}</strong>
            <div style="color:var(--es-muted);font-size:12px;margin-top:3px;">
              ${escapeHtml(item.service_name)}
            </div>
          </div>

          <span class="es-package-status">${escapeHtml(item.status)}</span>
        </div>

        <div class="es-package-progress">
          <span style="width:${progress}%"></span>
        </div>

        <div class="es-package-meta">
          <span>${used}/${total} completed</span>
          <span>${booked} booked</span>
          <span>${item.sessions_available_to_book} available</span>
        </div>

        <div class="es-package-meta">
          <span>Value ${money(item.price_minor)}</span>
          <span>Paid ${money(item.paid_minor)}</span>
          ${Number(item.consultation_credit_minor || 0) > 0
            ? `<span>Consultation credit ${money(item.consultation_credit_minor)}</span>`
            : ""}
          <span>Outstanding ${money(item.outstanding_minor)}</span>
        </div>

        ${item.expires_on
          ? `<div class="es-package-meta"><span>Expires ${shortDate(item.expires_on)}</span></div>`
          : ""}

        <div class="es-package-actions">
          ${item.status === "active" && Number(item.sessions_available_to_book) > 0
            ? `
              <a
                class="es-button"
                href="/bookings/?package=${encodeURIComponent(item.id)}"
              >
                Book next session
              </a>
            `
            : ""}

          ${item.status === "active" && Number(item.outstanding_minor) > 0
            ? `
              <button
                class="es-secondary-button"
                type="button"
                data-package-payment="${escapeHtml(item.id)}"
              >
                Record payment
              </button>
            `
            : ""}

          ${item.status === "active"
            ? `
              <button
                class="es-secondary-button"
                type="button"
                data-package-status="${escapeHtml(item.id)}"
                data-status-value="cancelled"
              >
                Cancel package
              </button>
            `
            : ""}
        </div>
      </article>
    `;
  }).join("");

  wrap.querySelectorAll("[data-package-payment]").forEach(button => {
    button.addEventListener("click", () => {
      const item = customerPackages.find(
        p => p.id === button.dataset.packagePayment
      );
      if (item) openPaymentDialog(item);
    });
  });

  wrap.querySelectorAll("[data-package-status]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Cancel this customer package? Existing bookings are not cancelled.")) {
        return;
      }

      await postPackage({
        action: "set_status",
        id: button.dataset.packageStatus,
        status: button.dataset.statusValue
      });

      await load();
    });
  });
}

function populateSelects() {
  $("#templateService").innerHTML =
    `<option value="">Choose service</option>` +
    services.map(service => `
      <option value="${escapeHtml(service.id)}">
        ${escapeHtml(service.name)}
      </option>
    `).join("");

  $("#assignCustomer").innerHTML =
    `<option value="">Choose customer</option>` +
    customers.map(customer => `
      <option value="${escapeHtml(customer.id)}">
        ${escapeHtml(`${customer.first_name} ${customer.last_name}`)}
      </option>
    `).join("");

  $("#assignTemplate").innerHTML =
    `<option value="">Choose package</option>` +
    templates
      .filter(item => Number(item.is_active) === 1)
      .map(item => `
        <option value="${escapeHtml(item.id)}">
          ${escapeHtml(item.name)} · ${item.sessions_total} sessions · ${money(item.price_minor)}
        </option>
      `)
      .join("");
}

function openTemplateDialog(template = null) {
  $("#templateForm").reset();
  $("#templateStatus").hidden = true;

  $("#templateId").value = template?.id || "";
  $("#templateDialogTitle").textContent = template ? "Edit package" : "New package";
  $("#templateName").value = template?.name || "";
  $("#templateService").value = template?.service_id || "";
  $("#templateSessions").value = template?.sessions_total || "";
  $("#templatePrice").value =
    template ? (Number(template.price_minor || 0) / 100).toFixed(2) : "";
  $("#templateDeposit").value =
    template ? (Number(template.deposit_minor || 0) / 100).toFixed(2) : "0.00";
  $("#templateValidity").value = template?.validity_days || "";
  $("#templateDescription").value = template?.description || "";
  $("#templateActive").checked = template ? Number(template.is_active) === 1 : true;
  $("#templatePublic").checked = template ? Number(template.is_public) === 1 : false;

  $("#templateDialog").showModal();
}

function openAssignDialog() {
  $("#assignForm").reset();
  $("#assignStatus").hidden = true;
  $("#assignStartsOn").value = new Date().toISOString().slice(0, 10);
  $("#assignDialog").showModal();
}

function openPaymentDialog(item) {
  $("#packagePaymentForm").reset();
  $("#packagePaymentStatus").hidden = true;
  $("#paymentPackageId").value = item.id;
  $("#paymentDialogTitle").textContent =
    `Record payment · ${item.name_snapshot}`;
  $("#packagePaymentAmount").value =
    (Number(item.outstanding_minor || 0) / 100).toFixed(2);
  $("#paymentDialog").showModal();
}

async function postPackage(payload) {
  const response = await fetch("/api/packages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  handleAuth(response);

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to save package.");
  }

  return data;
}

$("#newTemplateButton").addEventListener("click", () => openTemplateDialog());
$("#assignPackageButton").addEventListener("click", openAssignDialog);
$("#closeTemplateDialog").addEventListener("click", () => $("#templateDialog").close());
$("#closeAssignDialog").addEventListener("click", () => $("#assignDialog").close());
$("#closePaymentDialog").addEventListener("click", () => $("#paymentDialog").close());

document.querySelectorAll("[data-package-view]").forEach(button => {
  button.addEventListener("click", () => {
    activeView = button.dataset.packageView;

    document.querySelectorAll("[data-package-view]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    $("#customerPackagesView").hidden = activeView !== "customers";
    $("#packageTemplatesView").hidden = activeView !== "templates";
  });
});

$("#templateForm").addEventListener("submit", async event => {
  event.preventDefault();

  const status = $("#templateStatus");
  status.hidden = false;
  status.className = "es-status";
  status.textContent = "Saving package…";

  try {
    await postPackage({
      action: "save_template",
      id: $("#templateId").value || undefined,
      name: $("#templateName").value.trim(),
      service_id: $("#templateService").value,
      sessions_total: Number($("#templateSessions").value),
      price_minor: Math.round(Number($("#templatePrice").value) * 100),
      deposit_minor: Math.round(Number($("#templateDeposit").value || 0) * 100),
      validity_days: $("#templateValidity").value || null,
      description: $("#templateDescription").value.trim(),
      is_active: $("#templateActive").checked ? 1 : 0,
      is_public: $("#templatePublic").checked ? 1 : 0
    });

    $("#templateDialog").close();
    await load();
  } catch (error) {
    status.className = "es-status error";
    status.textContent = error.message;
  }
});

$("#assignForm").addEventListener("submit", async event => {
  event.preventDefault();

  const status = $("#assignStatus");
  status.hidden = false;
  status.className = "es-status";
  status.textContent = "Assigning package…";

  try {
    const paymentChoice = $("#assignPaymentChoice").value;

    if (paymentChoice === "assign_only") {
      await postPackage({
        action: "assign",
        customer_id: $("#assignCustomer").value,
        package_template_id: $("#assignTemplate").value,
        starts_on: $("#assignStartsOn").value || null,
        notes: $("#assignNotes").value.trim()
      });

      $("#assignDialog").close();
      await load();
      return;
    }

    const response = await fetch("/api/packages/sale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        customer_id: $("#assignCustomer").value,
        package_template_id: $("#assignTemplate").value,
        payment_choice: paymentChoice
      })
    });

    handleAuth(response);
    const data = await response.json();

    if (
      response.ok &&
      data.ok &&
      data.payment_required === false
    ) {
      $("#assignDialog").close();
      await load();
      return;
    }

    if (!response.ok || !data.ok || !data.checkout_url) {
      throw new Error(data.error || "Unable to start package payment.");
    }

    location.href = data.checkout_url;
  } catch (error) {
    status.className = "es-status error";
    status.textContent = error.message;
  }
});

$("#packagePaymentForm").addEventListener("submit", async event => {
  event.preventDefault();

  const packageId = $("#paymentPackageId").value;
  const item = customerPackages.find(p => p.id === packageId);

  if (!item) return;

  const status = $("#packagePaymentStatus");
  status.hidden = false;
  status.className = "es-status";
  status.textContent = "Saving payment…";

  try {
    const amountMinor = Math.round(
      Number($("#packagePaymentAmount").value) * 100
    );

    const response = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        customer_id: item.customer_id,
        customer_package_id: item.id,
        appointment_id: null,
        amount_minor: amountMinor,
        payment_type:
          Number(item.paid_minor || 0) > 0 ? "balance" : "full",
        provider: "manual",
        payment_method: $("#packagePaymentMethod").value,
        provider_reference: $("#packagePaymentReference").value.trim(),
        notes:
          [
            `Package: ${item.name_snapshot}`,
            $("#packagePaymentNotes").value.trim()
          ].filter(Boolean).join(" · ")
      })
    });

    handleAuth(response);

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to record package payment.");
    }

    $("#paymentDialog").close();
    await load();
  } catch (error) {
    status.className = "es-status error";
    status.textContent = error.message;
  }
});

load().catch(error => {
  $("#customerPackagesList").innerHTML = `
    <div class="es-status error" style="grid-column:1/-1;">
      ${escapeHtml(error.message)}
    </div>
  `;
});
