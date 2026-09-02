const params = new URLSearchParams(location.search);
const rawHash =
  String(
    location.hash ||
    ""
  ).replace(
    /^#/,
    ""
  );

const hashParams =
  new URLSearchParams(
    rawHash
  );

const shortPreview =
  rawHash ===
  "preview";

const requestedTemplateId =
  String(
    params.get("template_id") ||
    hashParams.get("template_id") ||
    ""
  ).trim();

if (requestedTemplateId) {
  try {
    sessionStorage.setItem(
      "eselram.preview.template_id",
      requestedTemplateId
    );
  } catch {}
}

const templateId = String(
  requestedTemplateId ||
  (
    shortPreview
      ? (() => {
          try {
            return sessionStorage.getItem(
              "eselram.preview.template_id"
            ) || "";
          } catch {
            return "";
          }
        })()
      : ""
  )
).trim();

const publicToken = String(
  params.get("token") ||
  hashParams.get("token") ||
  ""
).trim();

const requestToken = String(
  params.get("request_token") ||
  hashParams.get("request_token") ||
  ""
).trim();

const mode = String(
  params.get("mode") ||
  hashParams.get("mode") ||
  (
    shortPreview
      ? "preview"
      : ""
  )
).trim().toLowerCase();

const isPreview =
  mode ===
  "preview";

const formRoot = document.getElementById("formRoot");
const previewBanner = document.getElementById("previewBanner");
const closePreviewButton = document.getElementById("closePreviewButton");

let formDefinition = null;
let signatures = new Map();

if (isPreview) {
  previewBanner.hidden = false;

  /*
   * Cosmetic only: hide the long template identifier from the visible
   * preview URL after it has already been read above.
   */
  try {
    history.replaceState(
      null,
      "",
      `${location.pathname}#preview`
    );
  } catch {}
}

closePreviewButton?.addEventListener("click", () => {
  window.close();
  if (!window.closed) {
    history.back();
  }
});

async function loadForm() {
  try {
    const query = isPreview
      ? `template_id=${encodeURIComponent(templateId)}&mode=preview`
      : requestToken
        ? `request_token=${encodeURIComponent(requestToken)}`
        : `token=${encodeURIComponent(publicToken)}`;

    const response = await fetch(`/api/forms/public?${query}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (response.status === 401 && (isPreview || requestToken.startsWith("fri_"))) {
      location.href = "/auth/login.html";
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load form.");
    }

    formDefinition = data;
    applyBranding(data.branding || {});
    renderForm(data);
  } catch (error) {
    formRoot.innerHTML = `
      <div class="es-form-render-card">
        <div class="es-form-render-header">
          <h1>Unable to open form</h1>
          <p>${escapeHtml(error.message || "This form is unavailable.")}</p>
        </div>
      </div>
    `;
  }
}

function applyBranding(branding) {
  const page = document.getElementById("formPage");

  page.style.setProperty("--client-primary", branding.primary_colour || "#365c50");
  page.style.setProperty("--client-accent", branding.accent_colour || "#6f8079");
  page.style.setProperty("--client-bg", branding.background_colour || "#f5f4ef");
  page.style.setProperty("--client-surface", branding.surface_colour || "#ffffff");
  page.style.setProperty("--client-text", branding.text_colour || "#18221f");

  if (branding.form_style === "dark") {
    page.style.setProperty("--client-bg", branding.background_colour || "#202723");
    page.style.setProperty("--client-surface", branding.surface_colour || "#29322d");
    page.style.setProperty("--client-text", branding.text_colour || "#f4f6f2");
  }
}

function renderForm(data) {
  const template = data.template;
  const branding = data.branding || {};
  const business = data.business || {};

  document.title = `${template.name} | ${business.name || "Form"}`;

  formRoot.innerHTML = `
    <div class="es-form-render-brand ${branding.logo_position === "left" ? "left" : ""}">
      ${
        branding.logo_data_url
          ? `<img class="es-form-render-logo" src="${branding.logo_data_url}" alt="">`
          : ""
      }

      ${
        branding.show_business_name !== 0
          ? `<h2 class="es-form-render-business">${escapeHtml(business.name || "")}</h2>`
          : ""
      }
    </div>

    <form id="renderedForm" class="es-form-render-card" novalidate>
      <div class="es-form-render-header">
        <h1>${escapeHtml(template.name)}</h1>
        ${
          template.description
            ? `<p>${escapeHtml(template.description)}</p>`
            : ""
        }
      </div>

      <div id="renderError" class="es-form-render-error" hidden></div>

      <div id="renderSections">
        ${(template.sections || []).map(renderSection).join("")}
      </div>

      <div class="es-form-render-submit">
        <button id="submitRenderedForm" type="submit" ${isPreview ? "disabled" : ""}>
          ${isPreview ? "Preview only" : "Submit form"}
        </button>
      </div>
    </form>

    <div class="es-form-render-footer">
      ${
        branding.footer_text
          ? escapeHtml(branding.footer_text)
          : branding.show_contact_details !== 0
            ? escapeHtml(business.contact_line || business.name || "")
            : ""
      }
    </div>
  `;

  setupConditionalLogic();
  setupSignatures();

  document.getElementById("renderedForm").addEventListener("submit", submitForm);
}

function renderSection(section) {
  return `
    <section
      class="es-form-render-section"
      data-section-id="${escapeHtml(section.id)}"
      data-section-title="${escapeAttribute(section.title || "")}"
      data-condition='${escapeAttribute(JSON.stringify(section.condition || null))}'
    >
      <h2>${escapeHtml(section.title)}</h2>

      ${
        section.description
          ? `<p>${escapeHtml(section.description)}</p>`
          : ""
      }

      <div class="es-form-render-fields">
        ${(section.fields || []).map(renderField).join("")}
      </div>
    </section>
  `;
}

function renderField(field) {
  // File uploads are intentionally disabled across all client-facing forms.
  // Existing legacy templates may still contain file_upload fields in D1;
  // keep them invisible rather than breaking the rest of the form.
  if (field.field_type === "file_upload") {
    return "";
  }
  const key = escapeHtml(field.field_key);
  const requiredMarker = field.is_required === 1
    ? `<span class="es-form-render-required">*</span>`
    : "";

  const conditionAttr = escapeAttribute(JSON.stringify(field.condition || null));

  let control = "";

  if (field.field_type === "long_text") {
    control = `
      <textarea
        name="${key}"
        data-field-key="${key}"
        ${field.is_required === 1 ? "required" : ""}
        placeholder="${escapeAttribute(field.placeholder || "")}"
      ></textarea>
    `;
  } else if (field.field_type === "yes_no") {
    control = `
      <div class="es-form-render-choice">
        <label>
          <input
            type="radio"
            name="${key}"
            value="Yes"
            data-field-key="${key}"
            ${field.is_required === 1 ? "required" : ""}
          >
          Yes
        </label>

        <label>
          <input
            type="radio"
            name="${key}"
            value="No"
            data-field-key="${key}"
          >
          No
        </label>
      </div>
    `;
  } else if (field.field_type === "checkbox") {
    control = `
      <label class="es-form-render-check-tile">
        <input
          type="checkbox"
          name="${key}"
          value="Yes"
          data-field-key="${key}"
          ${field.is_required === 1 ? "required" : ""}
        >
        <span class="es-form-render-check-mark" aria-hidden="true"></span>
        <span>${escapeHtml(field.label)}</span>
        ${requiredMarker}
      </label>
    `;
  } else if (field.field_type === "dropdown") {
    control = `
      <select
        name="${key}"
        data-field-key="${key}"
        ${field.is_required === 1 ? "required" : ""}
      >
        <option value="">Select…</option>
        ${(field.options || []).map(option => `
          <option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>
        `).join("")}
      </select>
    `;
  } else if (field.field_type === "date") {
    control = `
      <input
        type="date"
        name="${key}"
        data-field-key="${key}"
        ${field.is_required === 1 ? "required" : ""}
      >
    `;
  } else if (field.field_type === "number") {
    control = `
      <input
        type="number"
        name="${key}"
        data-field-key="${key}"
        ${field.is_required === 1 ? "required" : ""}
        placeholder="${escapeAttribute(field.placeholder || "")}"
      >
    `;
  } else if (field.field_type === "signature") {
    control = `
      <div class="es-form-render-signature">
        <canvas data-signature-key="${key}"></canvas>

        <div class="es-form-render-signature-actions">
          <button class="es-secondary-button" type="button" data-clear-signature="${key}">
            Clear
          </button>
        </div>
      </div>
    `;
  } else {
    control = `
      <input
        type="text"
        name="${key}"
        data-field-key="${key}"
        ${field.is_required === 1 ? "required" : ""}
        placeholder="${escapeAttribute(field.placeholder || "")}"
      >
    `;
  }

  return `
    <div
      class="es-form-render-field es-form-render-field-${escapeHtml(field.field_type)}"
      data-field-wrapper="${key}"
      data-condition='${conditionAttr}'
    >
      ${
        field.field_type === "checkbox"
          ? ""
          : `<label>${escapeHtml(field.label)} ${requiredMarker}</label>`
      }

      ${control}

      ${
        field.help_text
          ? `<div class="es-form-render-help">${escapeHtml(field.help_text)}</div>`
          : ""
      }
    </div>
  `;
}

function setupConditionalLogic() {
  document.getElementById("renderedForm").addEventListener("input", evaluateConditions);
  document.getElementById("renderedForm").addEventListener("change", evaluateConditions);
  evaluateConditions();
}

function evaluateConditions() {
  const conditionalElements = [
    ...document.querySelectorAll(
      "[data-condition]"
    )
  ];

  const evaluateElement =
    (element) => {
      let condition = null;

      try {
        condition =
          JSON.parse(
            element.dataset.condition ||
            "null"
          );
      } catch {}

      let show = true;

      if (condition?.field_key) {
        const currentValue =
          getFieldValue(
            condition.field_key
          );

        const expected =
          String(
            condition.value ??
            ""
          );

        show =
          condition.operator ===
          "not_equals"
            ? String(currentValue) !==
              expected
            : String(currentValue) ===
              expected;
      }

      element.classList.toggle(
        "es-form-render-hidden",
        !show
      );
    };

  // Sections determine whether all child fields are available.
  conditionalElements
    .filter(
      element =>
        element.matches(
          ".es-form-render-section"
        )
    )
    .forEach(evaluateElement);

  // Field conditions are evaluated after their parent section.
  conditionalElements
    .filter(
      element =>
        !element.matches(
          ".es-form-render-section"
        )
    )
    .forEach(evaluateElement);

  // Required fields are enabled only when the field is genuinely visible.
  conditionalElements.forEach(
    element => {
      const visible =
        !element.classList.contains(
          "es-form-render-hidden"
        ) &&
        !element.parentElement?.closest(
          ".es-form-render-hidden"
        );

      setDescendantRequiredState(
        element,
        visible
      );
    }
  );
}

function getFieldValue(fieldKey) {
  const elements = Array.from(
    document.querySelectorAll(`[data-field-key="${cssEscape(fieldKey)}"]`)
  );

  if (!elements.length) return "";

  const first = elements[0];

  if (first.type === "radio") {
    return elements.find(item => item.checked)?.value || "";
  }

  if (first.type === "checkbox") {
    return first.checked ? (first.value || "Yes") : "No";
  }

  return first.value || "";
}

function setDescendantRequiredState(container, visible) {
  container.querySelectorAll("[required]").forEach(input => {
    if (!input.dataset.originalRequired) {
      input.dataset.originalRequired = "1";
    }

    input.required = visible;
  });

  if (visible) {
    container.querySelectorAll("[data-original-required='1']").forEach(input => {
      input.required = true;
    });
  }
}

function setupSignatures() {
  document.querySelectorAll("[data-signature-key]").forEach(canvas => {
    resizeCanvas(canvas);

    const key = canvas.dataset.signatureKey;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    let drawing = false;
    let hasInk = false;

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      return {
        x: source.clientX - rect.left,
        y: source.clientY - rect.top
      };
    }

    function start(event) {
      event.preventDefault();
      drawing = true;
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(event) {
      if (!drawing) return;
      event.preventDefault();
      const p = point(event);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasInk = true;
      signatures.set(key, canvas.toDataURL("image/png"));
    }

    function end(event) {
      if (!drawing) return;
      event?.preventDefault?.();
      drawing = false;

      if (hasInk) {
        signatures.set(key, canvas.toDataURL("image/png"));
      }
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);

    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end, { passive: false });

    document
      .querySelector(`[data-clear-signature="${cssEscape(key)}"]`)
      ?.addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        signatures.delete(key);
        hasInk = false;
      });
  });
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(window.devicePixelRatio || 1, 1);

  canvas.width = rect.width * ratio;
  canvas.height = 180 * ratio;
  canvas.style.height = "180px";

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
}

async function submitForm(event) {
  event.preventDefault();

  if (isPreview) return;

  const form = event.currentTarget;
  const errorBox = document.getElementById("renderError");
  errorBox.hidden = true;

  evaluateConditions();

  const visibleInvalid = Array.from(form.elements).find(element => {
    if (!element.required) return false;
    if (element.closest(".es-form-render-hidden")) return false;

    if (element.type === "radio") {
      const group = Array.from(form.querySelectorAll(`[name="${cssEscape(element.name)}"]`));
      return !group.some(item => item.checked);
    }

    if (element.type === "checkbox") {
      return !element.checked;
    }

    return !element.value;
  });

  if (visibleInvalid) {
    const wrapper =
      visibleInvalid.closest(
        "[data-field-wrapper]"
      );

    const label =
      wrapper
        ?.querySelector(
          ":scope > label"
        )
        ?.textContent
        ?.replace("*", "")
        ?.trim() ||
      wrapper
        ?.querySelector(
          ".es-form-render-check-tile span:last-of-type"
        )
        ?.textContent
        ?.trim() ||
      visibleInvalid.name ||
      "Required field";

    errorBox.hidden = false;
    errorBox.textContent =
      `Please complete "${label}".`;

    wrapper?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    visibleInvalid.focus?.();
    return;
  }

  const data = new FormData();

  if (requestToken) {
    data.append("request_token", requestToken);
  } else {
    data.append("token", publicToken);
  }

  for (const section of formDefinition.template.sections || []) {
    for (const field of section.fields || []) {
      const wrapper = form.querySelector(`[data-field-wrapper="${cssEscape(field.field_key)}"]`);

      if (
        wrapper?.closest(
          ".es-form-render-hidden"
        )
      ) {
        continue;
      }

      if (field.field_type === "signature") {
        const signature = signatures.get(field.field_key);

        if (signature) {
          data.append(`signature:${field.field_key}`, signature);
        } else if (field.is_required === 1) {
          errorBox.hidden = false;
          errorBox.textContent = `Please sign "${field.label}".`;
          return;
        }

        continue;
      }

      const elements = Array.from(
        form.querySelectorAll(`[data-field-key="${cssEscape(field.field_key)}"]`)
      );

      if (!elements.length) continue;

      if (field.field_type === "file_upload") {
        continue;
      }

      if (field.field_type === "yes_no") {
        const selected = elements.find(item => item.checked);
        data.append(`answer:${field.field_key}`, selected?.value || "");
      } else if (field.field_type === "checkbox") {
        data.append(
          `answer:${field.field_key}`,
          elements[0].checked ? (elements[0].value || "Yes") : "No"
        );
      } else {
        data.append(`answer:${field.field_key}`, elements[0].value || "");
      }
    }
  }

  const submitButton = document.getElementById("submitRenderedForm");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";

  try {
    let response = null;
    let result = null;
    let lastError = null;

    for (
      let attempt = 0;
      attempt < 2;
      attempt += 1
    ) {
      try {
        response =
          await fetch(
            "/api/forms/submissions",
            {
              method: "POST",
              body: data,
              headers: {
                Accept:
                  "application/json"
              }
            }
          );

        result =
          await response.json();

        if (
          response.ok &&
          result.ok
        ) {
          lastError = null;
          break;
        }

        // Client/validation errors are not transient and must
        // still be shown immediately rather than retried.
        if (
          response.status < 500
        ) {
          throw new Error(
            result.error ||
            "Unable to submit form."
          );
        }

        lastError =
          new Error(
            result.error ||
            "Unable to submit form."
          );
      } catch (error) {
        lastError = error;
      }

      if (
        attempt === 0
      ) {
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              350
            )
        );
      }
    }

    if (
      !response?.ok ||
      !result?.ok
    ) {
      throw (
        lastError ||
        new Error(
          "Unable to submit form."
        )
      );
    }

    const internalRecord = requestToken.startsWith("fri_");

    formRoot.innerHTML = `
      <div class="es-form-render-card">
        <div class="es-form-render-success">
          <h2>${internalRecord ? "Record saved" : "Thank you"}</h2>
          <p>${internalRecord ? "The clinical record has been saved to this customer. You can close this tab." : "Your form has been submitted successfully."}</p>
        </div>
      </div>
    `;

    if (internalRecord) {
      const customerId = String(
        formDefinition?.request?.customer_id || ""
      ).trim();

      if (customerId) {
        const customerUrl =
          `/customers/?customer=${encodeURIComponent(
            customerId
          )}`;

        if (
          window.opener &&
          !window.opener.closed
        ) {
          window.opener.postMessage(
            {
              type:
                "eselram:clinical-record-saved",
              customer_id:
                customerId
            },
            location.origin
          );

          setTimeout(() => {
            try {
              window.opener.location.href =
                customerUrl;
              window.opener.focus();
              window.close();
            } catch {
              window.location.href =
                customerUrl;
            }
          }, 450);
        } else {
          setTimeout(() => {
            window.location.href =
              customerUrl;
          }, 450);
        }
      }
    }
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error.message || "Unable to submit form.";
    submitButton.disabled = false;
    submitButton.textContent = "Submit form";
  }
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

loadForm();
