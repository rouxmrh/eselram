let packages = [];
let currency = "GBP";

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function money(minor) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency
  }).format(Number(minor || 0) / 100);
}

async function load() {
  const response = await fetch("/api/public-packages/config", {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Unable to load packages.");
  }

  packages = data.packages || [];
  currency = data.business?.currency || "GBP";
  $("#businessName").textContent =
    data.business?.name
      ? `${data.business.name} packages`
      : "Choose a package";

  render();
}

function render() {
  const wrap = $("#packageGrid");

  if (!packages.length) {
    wrap.innerHTML = `<div class="card"><strong>No packages are available to purchase online right now.</strong></div>`;
    return;
  }

  wrap.innerHTML = packages.map(item => `
    <article class="card">
      <small>${escapeHtml(item.service_name)}</small>
      <h2>${escapeHtml(item.name)}</h2>
      <div class="meta">
        <span>${item.sessions_total} sessions</span>
        ${item.validity_days ? `<span>${item.validity_days} days validity</span>` : ""}
      </div>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      <div class="price">${
        item.variants?.length
          ? `From ${money(
              Math.min(
                ...item.variants.map(
                  variant =>
                    Number(
                      variant.price_minor ||
                      0
                    )
                )
              )
            )}`
          : money(item.price_minor)
      }</div>
      ${
        item.variants?.length
          ? `<div class="meta"><span>${item.variants.length} options</span></div>`
          : ""
      }
      ${Number(item.deposit_minor || 0) > 0
        ? `<div class="meta"><span>Deposit option ${money(item.deposit_minor)}</span></div>`
        : ""}
      ${
        Number(
          item.requires_consultation ||
          0
        ) === 1
          ? `<div class="meta"><span>First visit: consultation first · Existing clients: package available after a completed consultation</span></div>`
          : ""
      }
      <div class="actions">
        <button class="primary" type="button" data-buy="${escapeHtml(item.id)}">Buy package</button>
      </div>
    </article>
  `).join("");

  wrap.querySelectorAll("[data-buy]").forEach(button => {
    button.addEventListener("click", () => openPurchase(button.dataset.buy));
  });
}

function openPurchase(id) {
  const item = packages.find(p => p.id === id);
  if (!item) return;

  $("#packageId").value = item.id;
  $("#purchaseTitle").textContent = item.name;

  $("#packageVariantChoice")?.remove();

  if (item.variants?.length) {
    const label = document.createElement("label");
    label.id = "packageVariantChoice";
    label.innerHTML = `
      Variant
      <select id="packageVariantId" required>
        ${item.variants.map(
          variant => `
            <option value="${escapeHtml(variant.id)}">
              ${escapeHtml(variant.name)} · ${money(variant.price_minor)}
            </option>
          `
        ).join("")}
      </select>
    `;
    $("#purchaseSummary").insertAdjacentElement("afterend", label);
  }

  function updatePurchaseSummary() {
    const variant =
      item.variants?.find(
        candidate =>
          candidate.id ===
          $("#packageVariantId")?.value
      ) ||
      null;

    const priceMinor =
      Number(
        variant?.price_minor ??
        item.price_minor ??
        0
      );

    const depositMinor =
      Number(
        variant?.deposit_minor ??
        item.deposit_minor ??
        0
      );

    $("#purchaseSummary").textContent =
      `${item.sessions_total} sessions${
        variant ? ` · ${variant.name}` : ""
      } · ${money(priceMinor)}`;

    $("#paymentChoice").innerHTML =
      `<option value="full">Pay in full · ${money(priceMinor)}</option>` +
      (
        depositMinor > 0
          ? `<option value="deposit">Pay deposit · ${money(depositMinor)}</option>`
          : ""
      );
  }

  $("#packageVariantId")?.addEventListener(
    "change",
    updatePurchaseSummary
  );

  updatePurchaseSummary();

  $("#purchasePanel").hidden = false;
  $("#status").hidden = true;
  $("#purchasePanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#cancelPurchase").addEventListener("click", () => {
  $("#purchasePanel").hidden = true;
});

$("#purchaseForm").addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("#status");
  status.hidden = false;
  status.className = "status";
  status.textContent = "Opening secure payment…";

  try {
    const response = await fetch("/api/public-packages/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        package_template_id: $("#packageId").value,
        package_variant_id:
          $("#packageVariantId")?.value ||
          null,
        first_name: $("#firstName").value.trim(),
        last_name: $("#lastName").value.trim(),
        email: $("#email").value.trim(),
        phone: $("#phone").value.trim(),
        payment_choice: $("#paymentChoice").value
      })
    });

    const data = await response.json();

    if (
      !response.ok ||
      !data.ok ||
      (!data.checkout_url && data.payment_required !== false)
    ) {
      if (
        data.consultation_required
      ) {
        status.className =
          "status error";

        status.innerHTML =
          `${escapeHtml(
            data.error ||
            "A consultation must be completed first."
          )} <a href="/book/?service_id=${encodeURIComponent(
            data.service_id ||
            ""
          )}">Book consultation</a>`;

        return;
      }

      throw new Error(
        data.error ||
        "Unable to start payment."
      );
    }

    if (data.payment_required === false && data.sale_id) {
      location.href = `/buy-package/success/?sale_id=${encodeURIComponent(data.sale_id)}`;
      return;
    }

    location.href =
      data.checkout_url;
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  }
});

if (new URLSearchParams(location.search).get("cancelled") === "1") {
  const status = $("#status");
  $("#purchasePanel").hidden = false;
  status.hidden = false;
  status.className = "status error";
  status.textContent = "Payment was cancelled. No package has been activated.";
}

load().catch(error => {
  $("#packageGrid").innerHTML =
    `<div class="card error">${escapeHtml(error.message)}</div>`;
});
