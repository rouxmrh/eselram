const $ = (selector) => document.querySelector(selector);

let templates = [];
let customerPackages = [];
let customers = [];
let services = [];
let packageVariants = [];
let currency = "GBP";
let activeView = "customers";
let activePackageCheckout = null;

let packageCheckoutPollTimer = null;


function stopPackageCheckoutPolling() {
  if (packageCheckoutPollTimer) {
    clearTimeout(
      packageCheckoutPollTimer
    );

    packageCheckoutPollTimer =
      null;
  }
}


async function verifyActivePackageCheckout({
  scheduleNext = true
} = {}) {
  const saleId =
    activePackageCheckout
      ?.sale_id ||
    "";

  if (!saleId) {
    stopPackageCheckoutPolling();
    return;
  }

  try {
    const response =
      await fetch(
        `/api/packages/sale?sale_id=${encodeURIComponent(
          saleId
        )}`,
        {
          headers: {
            Accept:
              "application/json"
          },
          cache:
            "no-store"
        }
      );

    handleAuth(
      response
    );

    const data =
      await response.json();

    if (
      response.ok &&
      data.ok &&
      data.status === "paid"
    ) {
      stopPackageCheckoutPolling();

      const status =
        $("#packageCheckoutStatus");

      status.hidden =
        false;

      status.className =
        "es-status success";

      status.textContent =
        "Payment received. Package activated and confirmation email sent.";

      await load();

      /*
       * Clear the active sale immediately so a near-simultaneous Close click
       * cannot run the cancellation endpoint after payment has been verified.
       */
      activePackageCheckout =
        null;

      window.setTimeout(
        () => {
          if (
            $("#packageCheckoutDialog")
              .open
          ) {
            $("#packageCheckoutDialog")
              .close();
          }
        },
        1200
      );

      return;
    }

    if (
      response.ok &&
      data.ok &&
      [
        "failed",
        "cancelled"
      ].includes(
        data.status
      )
    ) {
      stopPackageCheckoutPolling();
      return;
    }
  } catch (error) {
    console.error(
      "Unable to verify package checkout:",
      error
    );
  }

  if (
    scheduleNext &&
    activePackageCheckout
      ?.sale_id === saleId
  ) {
    packageCheckoutPollTimer =
      window.setTimeout(
        () =>
          verifyActivePackageCheckout(),
        2000
      );
  }
}


function startPackageCheckoutPolling() {
  stopPackageCheckoutPolling();

  packageCheckoutPollTimer =
    window.setTimeout(
      () =>
        verifyActivePackageCheckout(),
      1500
    );
}


window.addEventListener(
  "focus",
  () => {
    if (
      activePackageCheckout
        ?.sale_id
    ) {
      verifyActivePackageCheckout({
        scheduleNext:
          false
      });
    }
  }
);


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
  packageVariants = data.variants || [];
  templates = templates.map(template => ({
    ...template,
    variants: packageVariants.filter(variant => variant.package_template_id === template.id)
  }));
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

function packageTemplateCard(
  item,
  archived = false
) {
  return `
    <article class="es-package-card">
      <div class="es-package-card-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <span>${escapeHtml(item.service_name)}</span>
        </div>

        <span class="es-package-status">
          ${archived ? "Archived" : "Active"}
        </span>
      </div>

      <div class="es-package-meta">
        <span>${item.sessions_total} sessions</span>
        ${item.variants?.length
          ? `<span>${item.variants.length} variants · from ${money(Math.min(...item.variants.map(v => Number(v.price_minor || 0))))}</span>`
          : `<span>${money(item.price_minor)}</span>`}

        ${Number(item.deposit_minor || 0) > 0
          ? `<span>${money(item.deposit_minor)} suggested deposit</span>`
          : ""}

        ${item.validity_days
          ? `<span>${item.validity_days} days validity</span>`
          : `<span>No expiry rule</span>`}

        ${item.is_public && !archived
          ? `<span>Public purchase enabled</span>`
          : ""}
      </div>

      ${item.description
        ? `<p>${escapeHtml(item.description)}</p>`
        : ""}

      <div class="es-package-actions">
        ${
          archived
            ? `
              <button
                class="es-secondary-button"
                type="button"
                data-restore-template="${escapeHtml(item.id)}"
              >
                Restore
              </button>
            `
            : `
              <button
                class="es-secondary-button"
                type="button"
                data-edit-template="${escapeHtml(item.id)}"
              >
                Edit
              </button>

              <button
                class="es-secondary-button es-package-action-danger"
                type="button"
                data-archive-template="${escapeHtml(item.id)}"
              >
                Delete
              </button>
            `
        }
      </div>
    </article>
  `;
}


function bindTemplateActions(root) {
  root
    .querySelectorAll(
      "[data-edit-template]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const template =
            templates.find(
              item =>
                item.id ===
                button.dataset.editTemplate
            );

          if (template) {
            openTemplateDialog(
              template
            );
          }
        }
      );
    });

  root
    .querySelectorAll(
      "[data-archive-template]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const template =
            templates.find(
              item =>
                item.id ===
                button.dataset.archiveTemplate
            );

          if (!template) {
            return;
          }

          const confirmed =
            window.confirm(
              `Delete "${template.name}" from active packages? It will move to Archived packages and can be restored later. Existing customer packages are not affected.`
            );

          if (!confirmed) {
            return;
          }

          button.disabled = true;
          const original =
            button.textContent;
          button.textContent =
            "Archiving…";

          try {
            await postPackage({
              action:
                "archive_template",
              id:
                template.id
            });

            await load();
          } catch (error) {
            window.alert(
              error.message ||
              "Unable to archive package."
            );

            button.disabled = false;
            button.textContent =
              original;
          }
        }
      );
    });

  root
    .querySelectorAll(
      "[data-restore-template]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const template =
            templates.find(
              item =>
                item.id ===
                button.dataset.restoreTemplate
            );

          if (!template) {
            return;
          }

          button.disabled = true;
          const original =
            button.textContent;
          button.textContent =
            "Restoring…";

          try {
            await postPackage({
              action:
                "restore_template",
              id:
                template.id
            });

            await load();
          } catch (error) {
            window.alert(
              error.message ||
              "Unable to restore package."
            );

            button.disabled = false;
            button.textContent =
              original;
          }
        }
      );
    });
}


function renderTemplates() {
  const activeWrap =
    $("#packageTemplatesList");

  const archivedWrap =
    $("#archivedPackageTemplatesList");

  const archiveCount =
    $("#packageArchiveCount");

  const archive =
    $("#packageArchive");

  const activeTemplates =
    templates.filter(
      item =>
        Number(item.is_active) === 1
    );

  const archivedTemplates =
    templates.filter(
      item =>
        Number(item.is_active) !== 1
    );

  archiveCount.textContent =
    archivedTemplates.length;

  if (!activeTemplates.length) {
    activeWrap.innerHTML = `
      <div class="es-empty-state" style="grid-column:1/-1;">
        <strong>No active package templates.</strong>
        <span>Create a reusable package such as 6 sessions, a course of 3, or restore one from the archive.</span>
      </div>
    `;
  } else {
    activeWrap.innerHTML =
      activeTemplates
        .map(
          item =>
            packageTemplateCard(
              item,
              false
            )
        )
        .join("");
  }

  if (!archivedTemplates.length) {
    archivedWrap.innerHTML = `
      <div class="es-empty-state" style="grid-column:1/-1;">
        <strong>No archived packages.</strong>
        <span>Deleted package templates will be kept here so they can be restored later.</span>
      </div>
    `;
    archive.removeAttribute(
      "open"
    );
  } else {
    archivedWrap.innerHTML =
      archivedTemplates
        .map(
          item =>
            packageTemplateCard(
              item,
              true
            )
        )
        .join("");
  }

  bindTemplateActions(
    activeWrap
  );

  bindTemplateActions(
    archivedWrap
  );
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
          ${escapeHtml(item.name)} · ${item.sessions_total} sessions${item.variants?.length ? ` · ${item.variants.length} variants` : ` · ${money(item.price_minor)}`}
        </option>
      `)
      .join("");
}

function serviceOptionsHtml(selectedId = "") {
  return services
    .filter(service => String(service.service_type || "standard") !== "consultation")
    .map(service => `<option value="${escapeHtml(service.id)}" ${service.id === selectedId ? "selected" : ""}>${escapeHtml(service.name)}</option>`)
    .join("");
}

function renderVariantEmpty() {
  const wrap = $("#packageVariantRows");
  wrap.querySelector(".es-package-variants-empty")?.remove();
  if (!wrap.querySelector(".es-package-variant-row")) {
    wrap.insertAdjacentHTML("beforeend", `<div class="es-package-variants-empty">No variants added. The package will use the default service, price and deposit above.</div>`);
  }
}

function addVariantRow(variant = null) {
  const wrap = $("#packageVariantRows");
  wrap.querySelector(".es-package-variants-empty")?.remove();

  const row = document.createElement("div");
  row.className = "es-package-variant-row";
  row.dataset.variantId = variant?.id || "";

  row.innerHTML = `
    <label>Variant<input data-v-name type="text" maxlength="100" placeholder="e.g. Small" value="${escapeHtml(variant?.name || "")}"></label>
    <label>Service<select data-v-service><option value="">Choose service</option>${serviceOptionsHtml(variant?.service_id || "")}</select></label>
    <label>Price<input data-v-price type="number" min="0" step="0.01" value="${variant ? (Number(variant.price_minor || 0) / 100).toFixed(2) : ""}"></label>
    <label>
      Payment rule
      <select data-v-rule>
        <option value="full" ${(variant?.payment_rule || "full") === "full" ? "selected" : ""}>Full payment</option>
        <option value="deposit" ${variant?.payment_rule === "deposit" ? "selected" : ""}>Deposit</option>
        <option value="pay_later" ${variant?.payment_rule === "pay_later" ? "selected" : ""}>Pay later / staff managed</option>
      </select>
    </label>
    <label data-v-deposit-wrap>Deposit amount<input data-v-deposit type="number" min="0" step="0.01" value="${variant ? (Number(variant.deposit_minor || 0) / 100).toFixed(2) : "0.00"}"></label>
    <button class="es-secondary-button" type="button" data-v-remove>Remove</button>
  `;

  const rule = row.querySelector("[data-v-rule]");
  const depositWrap = row.querySelector("[data-v-deposit-wrap]");

  function updateVariantPaymentVisibility() {
    depositWrap.hidden = rule.value !== "deposit";
    if (depositWrap.hidden) {
      row.querySelector("[data-v-deposit]").value = "0.00";
    }
  }

  rule.addEventListener("change", updateVariantPaymentVisibility);
  updateVariantPaymentVisibility();

  row.querySelector("[data-v-remove]").addEventListener("click", () => {
    row.remove();
    renderVariantEmpty();
    updateVariantPricingMode();
  });

  wrap.append(row);
  updateVariantPricingMode();
}

function readVariants() {
  return [...document.querySelectorAll(".es-package-variant-row")]
    .map(row => ({
      id: row.dataset.variantId || null,
      name: row.querySelector("[data-v-name]").value.trim(),
      service_id: row.querySelector("[data-v-service]").value,
      price_minor: Math.round(Number(row.querySelector("[data-v-price]").value || 0) * 100),
      payment_rule: row.querySelector("[data-v-rule]").value,
      deposit_minor:
        row.querySelector("[data-v-rule]").value === "deposit"
          ? Math.round(Number(row.querySelector("[data-v-deposit]").value || 0) * 100)
          : 0
    }))
    .filter(variant => variant.name || variant.service_id);
}

function updateAssignVariantOptions() {
  const template = templates.find(item => item.id === $("#assignTemplate").value);
  const variants = (template?.variants || []).filter(v => Number(v.is_active) === 1);
  $("#assignVariantWrap").hidden = !variants.length;
  $("#assignVariant").required = Boolean(variants.length);
  $("#assignVariant").innerHTML = variants.length
    ? `<option value="">Choose variant</option>` + variants.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)} · ${escapeHtml(v.service_name)} · ${money(v.price_minor)}</option>`).join("")
    : "";


  updateAssignPaymentRule();
}

function updateAssignPaymentRule() {
  const template =
    templates.find(
      item =>
        item.id ===
        $("#assignTemplate").value
    );

  const variant =
    template?.variants?.find(
      item =>
        item.id ===
        $("#assignVariant").value
    );

  const rule =
    String(
      variant?.payment_rule ??
      template?.payment_rule ??
      "full"
    );

  const select =
    $("#assignPaymentChoice");

  if (rule === "deposit") {
    select.innerHTML = `
      <option value="full">Take remaining balance in full online</option>
      <option value="deposit">Take configured deposit online</option>
    `;
  } else if (rule === "pay_later") {
    select.innerHTML =
      `<option value="assign_only">Assign now · record payment separately</option>`;
  } else {
    select.innerHTML =
      `<option value="full">Take full payment online</option>`;
  }
}


function updateVariantPricingMode() {
  const hasVariants = readVariants().length > 0;
  const price = $("#templatePrice");
  const paymentRule = $("#templatePaymentRule");
  const deposit = $("#templateDeposit");

  price.disabled = hasVariants;
  paymentRule.disabled = hasVariants;
  deposit.disabled = hasVariants;
  price.required = !hasVariants;

  price.classList.toggle("es-package-derived-field", hasVariants);
  paymentRule.classList.toggle("es-package-derived-field", hasVariants);
  deposit.classList.toggle("es-package-derived-field", hasVariants);

  $("#templatePriceHint").hidden = !hasVariants;
  $("#templatePaymentRuleHint").hidden = !hasVariants;
  $("#templateDepositHint").hidden = !hasVariants;

  if (hasVariants) {
    price.value = "";
    price.placeholder = "Set by package variants";
    paymentRule.value = "full";
    $("#templateDepositWrap").hidden = true;
    deposit.value = "";
  } else {
    price.placeholder = "";
    updateTemplatePaymentVisibility();
  }
}

function updateTemplatePaymentVisibility() {
  const hasVariants = readVariants().length > 0;
  const rule = $("#templatePaymentRule").value;

  $("#templateDepositWrap").hidden =
    hasVariants ||
    rule !== "deposit";

  if (!hasVariants && rule !== "deposit") {
    $("#templateDeposit").value = "0.00";
  }
}


function updatePackagePublicAvailability() {
  const service =
    services.find(
      item =>
        item.id ===
        $("#templateService").value
    );

  const publicToggle =
    $("#templatePublic");

  const note =
    $("#templatePublicNote");

  if (!service) {
    publicToggle.disabled = false;
    note.hidden = true;
    note.textContent = "";
    return;
  }

  const consultationService =
    String(
      service.service_type ||
      "standard"
    ) === "consultation";

  const practitionerManaged =
    Number(
      service.requires_consultation ||
      0
    ) === 1 &&
    String(
      service.post_consultation_booking ||
      "client_can_book"
    ) ===
      "practitioner_managed";

  if (
    consultationService ||
    practitionerManaged
  ) {
    publicToggle.checked =
      false;
    publicToggle.disabled =
      true;

    note.hidden = false;
    note.textContent =
      consultationService
        ? "Packages cannot be linked to a consultation service. Choose the related treatment/service instead."
        : "This service is practitioner managed after consultation, so its packages are sold or assigned internally and are not shown for public purchase.";

    return;
  }

  publicToggle.disabled =
    false;
  note.hidden = true;
  note.textContent = "";
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
  $("#templatePaymentRule").value =
    template?.payment_rule || "full";
  $("#templateDeposit").value =
    template ? (Number(template.deposit_minor || 0) / 100).toFixed(2) : "0.00";
  $("#templateValidity").value = template?.validity_days || "";
  $("#templateDescription").value = template?.description || "";
  $("#templateActive").checked = template ? Number(template.is_active) === 1 : true;
  $("#templatePublic").checked = template ? Number(template.is_public) === 1 : false;

  $("#packageVariantRows").innerHTML = "";
  for (const variant of template?.variants || []) addVariantRow(variant);
  renderVariantEmpty();
  updateVariantPricingMode();
  updateTemplatePaymentVisibility();

  updatePackagePublicAvailability();

  $("#templateDialog").showModal();
}

function openAssignDialog() {
  $("#assignForm").reset();
  $("#assignStatus").hidden = true;
  $("#assignStartsOn").value = new Date().toISOString().slice(0, 10);
  updateAssignVariantOptions();
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

$("#templateService").addEventListener(
  "change",
  updatePackagePublicAvailability
);
$("#addPackageVariant").addEventListener("click", () => {
  addVariantRow();
  updateVariantPricingMode();
});
$("#assignTemplate").addEventListener("change", updateAssignVariantOptions);
$("#assignVariant").addEventListener("change", updateAssignPaymentRule);

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
    const variants = readVariants();
    const derivedPriceMinor = variants.length
      ? Math.min(...variants.map(variant => Number(variant.price_minor || 0)))
      : Math.round(Number($("#templatePrice").value) * 100);
    const derivedDepositMinor = variants.length
      ? Math.min(...variants.map(variant => Number(variant.deposit_minor || 0)))
      : Math.round(Number($("#templateDeposit").value || 0) * 100);

    await postPackage({
      action: "save_template",
      id: $("#templateId").value || undefined,
      name: $("#templateName").value.trim(),
      service_id: $("#templateService").value,
      sessions_total: Number($("#templateSessions").value),
      price_minor: derivedPriceMinor,
      payment_rule:
        variants.length
          ? "full"
          : $("#templatePaymentRule").value,
      deposit_minor:
        variants.length
          ? 0
          : (
              $("#templatePaymentRule").value === "deposit"
                ? derivedDepositMinor
                : 0
            ),
      validity_days: $("#templateValidity").value || null,
      description: $("#templateDescription").value.trim(),
      is_active: $("#templateActive").checked ? 1 : 0,
      is_public: $("#templatePublic").checked ? 1 : 0,
      variants
    });

    $("#templateDialog").close();
    await load();
  } catch (error) {
    status.className = "es-status error";
    status.textContent = error.message;
  }
});


function openPackageCheckoutDialog(data) {
  activePackageCheckout = data;

  $("#packageCheckoutContext").textContent =
    "Secure Stripe payment";

  $("#packageCheckoutAmount").textContent =
    `${money(data.amount_minor)} ready to collect`;

  $("#packageCheckoutLink").value =
    data.checkout_url;

  $("#openPackageCheckoutLink").href =
    data.checkout_url;

  $("#packageCheckoutStatus").hidden =
    true;

  if (
    window.EselramQr &&
    typeof window.EselramQr.toDataUrl ===
      "function"
  ) {
    $("#packageCheckoutQr").src =
      window.EselramQr.toDataUrl(
        data.checkout_url,
        { quiet: 4 }
      );
  } else {
    $("#packageCheckoutQr").removeAttribute(
      "src"
    );
  }

  $("#packageCheckoutDialog").showModal();
  startPackageCheckoutPolling();
}


$("#closePackageCheckoutDialog").addEventListener(
  "click",
  async () => {
    const saleId =
      activePackageCheckout?.sale_id ||
      null;

    stopPackageCheckoutPolling();

    if (!saleId) {
      $("#packageCheckoutDialog").close();
      activePackageCheckout = null;
      return;
    }

    /*
     * Verify once before treating the checkout as abandoned. This prevents a
     * customer who has just paid in the other tab from being turned into a
     * false failed attempt when staff closes the modal quickly.
     */
    try {
      await verifyActivePackageCheckout({
        scheduleNext:
          false
      });
    } catch {
      // Continue to the safe cancellation attempt below.
    }

    if (
      !activePackageCheckout
    ) {
      return;
    }

    $("#packageCheckoutDialog").close();
    activePackageCheckout = null;

    try {
      const response =
        await fetch(
          "/api/packages/sale",
          {
            method:
              "DELETE",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json"
            },
            body:
              JSON.stringify({
                sale_id:
                  saleId
              })
          }
        );

      handleAuth(response);

      if (!response.ok) {
        console.error(
          "Unable to release cancelled package checkout."
        );
      }
    } catch (error) {
      console.error(
        "Unable to release cancelled package checkout:",
        error
      );
    }
  }
);


$("#copyPackageCheckoutLink").addEventListener(
  "click",
  async () => {
    const value =
      $("#packageCheckoutLink").value;

    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );
    } catch {
      $("#packageCheckoutLink").select();
      document.execCommand("copy");
    }

    const status =
      $("#packageCheckoutStatus");

    status.hidden = false;
    status.className =
      "es-status success";
    status.textContent =
      "Payment link copied.";
  }
);


$("#emailPackageCheckoutLink").addEventListener(
  "click",
  async () => {
    if (
      !activePackageCheckout?.payment_id ||
      !activePackageCheckout?.checkout_url
    ) {
      return;
    }

    const button =
      $("#emailPackageCheckoutLink");

    const status =
      $("#packageCheckoutStatus");

    button.disabled = true;
    status.hidden = false;
    status.className =
      "es-status";
    status.textContent =
      "Sending payment link…";

    try {
      const response =
        await fetch(
          "/api/payments/email-link",
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
                payment_id:
                  activePackageCheckout.payment_id,
                checkout_url:
                  activePackageCheckout.checkout_url,
                package_sale_id:
                  activePackageCheckout.sale_id
              })
          }
        );

      handleAuth(response);

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.error ||
          "Unable to email the payment link."
        );
      }

      status.className =
        "es-status success";

      status.textContent =
        `Payment link sent to ${result.recipient}.`;

    } catch (error) {
      status.className =
        "es-status error";

      status.textContent =
        error.message ||
        "Unable to email the payment link.";
    } finally {
      button.disabled = false;
    }
  }
);


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
        package_variant_id: $("#assignVariant").value || null,
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
        package_variant_id: $("#assignVariant").value || null,
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

    $("#assignDialog").close();

    openPackageCheckoutDialog({
      sale_id:
        data.sale_id,
      payment_id:
        data.payment_id,
      checkout_url:
        data.checkout_url,
      amount_minor:
        data.amount_minor
    });
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
