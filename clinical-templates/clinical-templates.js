const templateList = document.getElementById("templateList");
const templateEditor = document.getElementById("templateEditor");
const templateStatus = document.getElementById("templateStatus");
const starterLibrary = document.getElementById("starterTemplateLibrary");

let templates = [];
let starters = [];
let activeTemplate = null;

document
  .getElementById("newTemplateButton")
  .addEventListener("click", createBlankTemplate);

async function loadTemplates() {
  try {
    const response = await fetch("/api/clinical-templates", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (response.status === 401) {
      location.href = "/auth/login.html";
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to load clinical templates.");
    }

    templates = data.templates || [];
    starters = data.starters || [];

    renderStarterLibrary();
    renderTemplateList();

    if (activeTemplate?.id) {
      const refreshed = templates.find(item => item.id === activeTemplate.id);

      if (refreshed) {
        activeTemplate = structuredClone(refreshed);
        renderEditor();
      }
    }
  } catch (error) {
    showPageError(error.message || "Unable to load clinical templates.");
  }
}

function renderStarterLibrary() {
  starterLibrary.innerHTML = starters.map(starter => `
    <article class="es-template-library-card">
      <span class="es-template-badge">
        ${escapeHtml(formatTemplateType(starter.template_type))}
      </span>

      <h3>${escapeHtml(starter.name)}</h3>

      <p>${escapeHtml(starter.description)}</p>

      <p>
        ${starter.section_count} sections ·
        ${starter.field_count} fields
      </p>

      <div class="es-template-library-actions">
        <button
          class="es-button"
          type="button"
          data-use-starter="${escapeHtml(starter.key)}"
        >
          Use template
        </button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-use-starter]").forEach(button => {
    button.addEventListener("click", () => cloneStarter(button.dataset.useStarter));
  });
}

async function cloneStarter(key) {
  try {
    const response = await fetch("/api/clinical-templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        action: "clone_starter",
        starter_key: key
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to add starter template.");
    }

    templateStatus.hidden = false;
    templateStatus.className = "es-status success";
    templateStatus.textContent = "Starter template added to your business.";

    await loadTemplates();

    activeTemplate = structuredClone(
      templates.find(item => item.id === data.template?.id) || null
    );

    renderTemplateList();
    renderEditor();
  } catch (error) {
    showPageError(error.message || "Unable to add starter template.");
  }
}

function renderTemplateList() {
  if (templates.length === 0) {
    templateList.innerHTML = `
      <div class="es-empty-state">
        <strong>No business templates yet.</strong>
        <span>Choose a starter above or create a blank template.</span>
      </div>
    `;
    return;
  }

  templateList.innerHTML = templates.map(template => `
    <button
      class="es-template-list-button ${
        activeTemplate?.id === template.id ? "active" : ""
      }"
      type="button"
      data-template-id="${escapeHtml(template.id)}"
    >
      <strong>${escapeHtml(template.name)}</strong>
      <span>
        ${escapeHtml(formatTemplateType(template.template_type))}
        ${template.is_active === 1 ? "" : " · Inactive"}
      </span>
    </button>
  `).join("");

  document.querySelectorAll("[data-template-id]").forEach(button => {
    button.addEventListener("click", () => {
      const template = templates.find(item => item.id === button.dataset.templateId);

      if (!template) return;

      activeTemplate = structuredClone(template);
      renderTemplateList();
      renderEditor();
    });
  });
}

function createBlankTemplate() {
  activeTemplate = {
    id: null,
    name: "New clinical template",
    template_type: "consultation",
    description: "",
    is_active: 1,
    is_default: 0,
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Assessment",
        description: "",
        sort_order: 0,
        condition: null,
        fields: []
      }
    ]
  };

  renderTemplateList();
  renderEditor();
}

function renderEditor() {
  if (!activeTemplate) {
    templateEditor.innerHTML = `
      <div class="es-template-editor-empty">
        <strong>Select or create a template.</strong>
        <span>Add sections and questions, then save the template.</span>
      </div>
    `;
    return;
  }

  templateEditor.innerHTML = `
    <div class="es-template-meta">

      <div class="es-panel-header">
        <div>
          <p class="es-eyebrow">Template builder</p>
          <h2>${escapeHtml(activeTemplate.name)}</h2>
        </div>

        <span class="es-template-badge">
          ${escapeHtml(formatTemplateType(activeTemplate.template_type))}
        </span>
      </div>

      <div class="es-form-grid">
        <label>
          Template name
          <input id="templateName" type="text" value="${escapeHtml(activeTemplate.name)}">
        </label>

        <label>
          Template type
          <select id="templateType">
            ${templateTypeOption("consultation", "Consultation")}
            ${templateTypeOption("patch_test", "Patch test")}
            ${templateTypeOption("treatment_record", "Treatment record")}
            ${templateTypeOption("custom", "Custom")}
          </select>
        </label>
      </div>

      <label>
        Description
        <textarea id="templateDescription">${escapeHtml(activeTemplate.description || "")}</textarea>
      </label>

      <div class="es-check-grid">
        <label class="es-check-option">
          <input id="templateActive" type="checkbox" ${activeTemplate.is_active === 1 ? "checked" : ""}>
          Template is active
        </label>

        <label class="es-check-option">
          <input id="templateDefault" type="checkbox" ${activeTemplate.is_default === 1 ? "checked" : ""}>
          Default for this template type
        </label>
      </div>
    </div>

    <div id="templateSections">
      ${renderSections()}
    </div>

    <div class="es-template-footer-actions">
      <button id="addSectionButton" class="es-secondary-button" type="button">
        Add section
      </button>

      <button id="saveTemplateButton" class="es-button" type="button">
        Save template
      </button>

      ${
        activeTemplate.id
          ? `
            <button id="previewTemplateButton" class="es-secondary-button" type="button">
              Preview
            </button>

            <button id="publishTemplateButton" class="es-secondary-button" type="button">
              ${activeTemplate.is_published === 1 ? "Unpublish" : "Publish"}
            </button>

            ${
              activeTemplate.is_published === 1 && activeTemplate.public_token
                ? `
                  <button id="copyPublicLinkButton" class="es-secondary-button" type="button">
                    Copy public link
                  </button>
                `
                : ""
            }
          `
          : ""
      }

      ${
        activeTemplate.id
          ? `
            <button id="archiveTemplateButton" class="es-secondary-button" type="button">
              Archive template
            </button>
          `
          : ""
      }
    </div>
  `;

  bindEditorEvents();
}

function templateTypeOption(value, label) {
  return `
    <option value="${value}" ${activeTemplate.template_type === value ? "selected" : ""}>
      ${label}
    </option>
  `;
}

function renderSections() {
  return (activeTemplate.sections || [])
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((section, sectionIndex) => `
      <section class="es-template-section" data-section-index="${sectionIndex}">
        <div class="es-template-section-header">
          <div>
            <label>
              Section title
              <input
                type="text"
                data-section-title="${sectionIndex}"
                value="${escapeHtml(section.title)}"
              >
            </label>

            <label>
              Section description
              <input
                type="text"
                data-section-description="${sectionIndex}"
                value="${escapeHtml(section.description || "")}"
                placeholder="Optional"
              >
            </label>
          </div>

          <div class="es-template-section-actions">
            <button
              class="es-template-small-button"
              type="button"
              data-add-field="${sectionIndex}"
            >
              Add field
            </button>

            <button
              class="es-template-small-button danger"
              type="button"
              data-remove-section="${sectionIndex}"
            >
              Remove
            </button>
          </div>
        </div>

        ${renderConditionEditor(section.condition, `section:${sectionIndex}`)}

        <div class="es-template-fields">
          ${renderFields(section, sectionIndex)}
        </div>
      </section>
    `)
    .join("");
}

function renderFields(section, sectionIndex) {
  if (!section.fields?.length) {
    return `
      <div class="es-empty-state">
        <strong>No fields in this section.</strong>
        <span>Add a field to begin building the form.</span>
      </div>
    `;
  }

  return section.fields.map((field, fieldIndex) => `
    <div class="es-template-field">
      <label>
        Field label
        <input
          type="text"
          data-field-label="${sectionIndex}:${fieldIndex}"
          value="${escapeHtml(field.label)}"
        >
      </label>

      <label>
        Field type
        <select data-field-type="${sectionIndex}:${fieldIndex}">
          ${fieldTypeOption(field, "short_text", "Short text")}
          ${fieldTypeOption(field, "long_text", "Long text")}
          ${fieldTypeOption(field, "yes_no", "Yes / No")}
          ${fieldTypeOption(field, "checkbox", "Checkbox")}
          ${fieldTypeOption(field, "dropdown", "Dropdown")}
          ${fieldTypeOption(field, "date", "Date")}
          ${fieldTypeOption(field, "number", "Number")}
          ${fieldTypeOption(field, "signature", "Signature")}
          ${fieldTypeOption(field, "file_upload", "File upload")}
        </select>
      </label>

      <label class="es-template-required">
        <input
          type="checkbox"
          data-field-required="${sectionIndex}:${fieldIndex}"
          ${field.is_required === 1 ? "checked" : ""}
        >
        Required
      </label>

      <div class="es-template-field-actions">
        <button
          class="es-template-small-button danger"
          type="button"
          data-remove-field="${sectionIndex}:${fieldIndex}"
        >
          Remove
        </button>
      </div>

      <label class="es-template-options">
        Help text / placeholder
        <input
          type="text"
          data-field-help="${sectionIndex}:${fieldIndex}"
          value="${escapeHtml(field.help_text || "")}"
          placeholder="Optional guidance"
        >
      </label>

      ${
        field.field_type === "dropdown"
          ? `
            <label class="es-template-options">
              Dropdown choices
              <input
                type="text"
                data-field-options="${sectionIndex}:${fieldIndex}"
                value="${escapeHtml((field.options || []).join(", "))}"
                placeholder="Option 1, Option 2, Option 3"
              >
            </label>
          `
          : ""
      }

      ${renderConditionEditor(field.condition, `field:${sectionIndex}:${fieldIndex}`)}
    </div>
  `).join("");
}

function renderConditionEditor(condition, target) {
  const enabled = Boolean(condition?.field_key);

  return `
    <div class="es-template-condition">
      <label class="es-template-required">
        <input
          type="checkbox"
          data-condition-enabled="${target}"
          ${enabled ? "checked" : ""}
        >
        Show conditionally
      </label>

      ${
        enabled
          ? `
            <div class="es-template-condition-grid">
              <label>
                Depends on field
                <select data-condition-field="${target}">
                  <option value="">Select field</option>
                  ${allFieldOptions(condition.field_key)}
                </select>
              </label>

              <label>
                Rule
                <select data-condition-operator="${target}">
                  <option value="equals" ${condition.operator === "equals" ? "selected" : ""}>
                    Equals
                  </option>
                  <option value="not_equals" ${condition.operator === "not_equals" ? "selected" : ""}>
                    Does not equal
                  </option>
                </select>
              </label>

              <label>
                Value
                <input
                  type="text"
                  data-condition-value="${target}"
                  value="${escapeHtml(condition.value || "")}"
                  placeholder="e.g. Yes"
                >
              </label>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function allFieldOptions(selected) {
  return (activeTemplate.sections || [])
    .flatMap(section => section.fields || [])
    .map(field => `
      <option
        value="${escapeHtml(field.field_key)}"
        ${field.field_key === selected ? "selected" : ""}
      >
        ${escapeHtml(field.label)}
      </option>
    `)
    .join("");
}

function fieldTypeOption(field, value, label) {
  return `
    <option value="${value}" ${field.field_type === value ? "selected" : ""}>
      ${label}
    </option>
  `;
}

function bindEditorEvents() {
  document.getElementById("templateName").addEventListener("input", event => {
    activeTemplate.name = event.target.value;
  });

  document.getElementById("templateType").addEventListener("change", event => {
    activeTemplate.template_type = event.target.value;
    renderEditor();
  });

  document.getElementById("templateDescription").addEventListener("input", event => {
    activeTemplate.description = event.target.value;
  });

  document.getElementById("templateActive").addEventListener("change", event => {
    activeTemplate.is_active = event.target.checked ? 1 : 0;
  });

  document.getElementById("templateDefault").addEventListener("change", event => {
    activeTemplate.is_default = event.target.checked ? 1 : 0;
  });

  document.querySelectorAll("[data-section-title]").forEach(input => {
    input.addEventListener("input", () => {
      activeTemplate.sections[Number(input.dataset.sectionTitle)].title = input.value;
    });
  });

  document.querySelectorAll("[data-section-description]").forEach(input => {
    input.addEventListener("input", () => {
      activeTemplate.sections[Number(input.dataset.sectionDescription)].description = input.value;
    });
  });

  document.querySelectorAll("[data-add-field]").forEach(button => {
    button.addEventListener("click", () => {
      const sectionIndex = Number(button.dataset.addField);
      activeTemplate.sections[sectionIndex].fields.push(
        newField(activeTemplate.sections[sectionIndex].fields.length)
      );
      renderEditor();
    });
  });

  document.querySelectorAll("[data-remove-section]").forEach(button => {
    button.addEventListener("click", () => {
      activeTemplate.sections.splice(Number(button.dataset.removeSection), 1);
      normalizeSortOrder();
      renderEditor();
    });
  });

  bindFieldValueEvents();
  bindConditionEvents();

  document.getElementById("addSectionButton").addEventListener("click", () => {
    activeTemplate.sections.push({
      id: crypto.randomUUID(),
      title: "New section",
      description: "",
      sort_order: activeTemplate.sections.length,
      condition: null,
      fields: []
    });
    renderEditor();
  });

  document.getElementById("saveTemplateButton").addEventListener("click", saveTemplate);

  const previewButton = document.getElementById("previewTemplateButton");
  if (previewButton) {
    previewButton.addEventListener("click", () => {
      window.open(
        `/forms/view.html?template_id=${encodeURIComponent(activeTemplate.id)}&mode=preview`,
        "_blank",
        "noopener"
      );
    });
  }

  const publishButton = document.getElementById("publishTemplateButton");
  if (publishButton) {
    publishButton.addEventListener("click", togglePublish);
  }

  const copyButton = document.getElementById("copyPublicLinkButton");
  if (copyButton) {
    copyButton.addEventListener("click", copyPublicLink);
  }

  const archiveButton = document.getElementById("archiveTemplateButton");
  if (archiveButton) {
    archiveButton.addEventListener("click", archiveTemplate);
  }
}

function bindFieldValueEvents() {
  document.querySelectorAll("[data-field-label]").forEach(input => {
    input.addEventListener("input", () => {
      const [sectionIndex, fieldIndex] = parsePair(input.dataset.fieldLabel);
      activeTemplate.sections[sectionIndex].fields[fieldIndex].label = input.value;
    });
  });

  document.querySelectorAll("[data-field-type]").forEach(select => {
    select.addEventListener("change", () => {
      const [sectionIndex, fieldIndex] = parsePair(select.dataset.fieldType);
      activeTemplate.sections[sectionIndex].fields[fieldIndex].field_type = select.value;
      renderEditor();
    });
  });

  document.querySelectorAll("[data-field-required]").forEach(input => {
    input.addEventListener("change", () => {
      const [sectionIndex, fieldIndex] = parsePair(input.dataset.fieldRequired);
      activeTemplate.sections[sectionIndex].fields[fieldIndex].is_required =
        input.checked ? 1 : 0;
    });
  });

  document.querySelectorAll("[data-field-help]").forEach(input => {
    input.addEventListener("input", () => {
      const [sectionIndex, fieldIndex] = parsePair(input.dataset.fieldHelp);
      activeTemplate.sections[sectionIndex].fields[fieldIndex].help_text = input.value;
    });
  });

  document.querySelectorAll("[data-field-options]").forEach(input => {
    input.addEventListener("input", () => {
      const [sectionIndex, fieldIndex] = parsePair(input.dataset.fieldOptions);
      activeTemplate.sections[sectionIndex].fields[fieldIndex].options =
        input.value.split(",").map(value => value.trim()).filter(Boolean);
    });
  });

  document.querySelectorAll("[data-remove-field]").forEach(button => {
    button.addEventListener("click", () => {
      const [sectionIndex, fieldIndex] = parsePair(button.dataset.removeField);
      activeTemplate.sections[sectionIndex].fields.splice(fieldIndex, 1);
      normalizeSortOrder();
      renderEditor();
    });
  });
}

function bindConditionEvents() {
  document.querySelectorAll("[data-condition-enabled]").forEach(input => {
    input.addEventListener("change", () => {
      setCondition(input.dataset.conditionEnabled, input.checked ? {
        field_key: "",
        operator: "equals",
        value: ""
      } : null);
      renderEditor();
    });
  });

  document.querySelectorAll("[data-condition-field]").forEach(select => {
    select.addEventListener("change", () => {
      const condition = getCondition(select.dataset.conditionField) || {};
      condition.field_key = select.value;
      condition.operator = condition.operator || "equals";
      condition.value = condition.value || "";
      setCondition(select.dataset.conditionField, condition);
    });
  });

  document.querySelectorAll("[data-condition-operator]").forEach(select => {
    select.addEventListener("change", () => {
      const condition = getCondition(select.dataset.conditionOperator) || {};
      condition.operator = select.value;
      setCondition(select.dataset.conditionOperator, condition);
    });
  });

  document.querySelectorAll("[data-condition-value]").forEach(input => {
    input.addEventListener("input", () => {
      const condition = getCondition(input.dataset.conditionValue) || {};
      condition.value = input.value;
      setCondition(input.dataset.conditionValue, condition);
    });
  });
}

function getCondition(target) {
  const parts = target.split(":");

  if (parts[0] === "section") {
    return activeTemplate.sections[Number(parts[1])].condition;
  }

  return activeTemplate.sections[Number(parts[1])].fields[Number(parts[2])].condition;
}

function setCondition(target, condition) {
  const parts = target.split(":");

  if (parts[0] === "section") {
    activeTemplate.sections[Number(parts[1])].condition = condition;
    return;
  }

  activeTemplate.sections[Number(parts[1])].fields[Number(parts[2])].condition = condition;
}

function newField(sortOrder) {
  return {
    id: crypto.randomUUID(),
    label: "New field",
    field_key: `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    field_type: "short_text",
    help_text: "",
    placeholder: "",
    options: [],
    is_required: 0,
    sort_order: sortOrder,
    condition: null
  };
}

function normalizeSortOrder() {
  activeTemplate.sections.forEach((section, sectionIndex) => {
    section.sort_order = sectionIndex;
    section.fields.forEach((field, fieldIndex) => {
      field.sort_order = fieldIndex;
    });
  });
}

function parsePair(value) {
  return value.split(":").map(Number);
}

async function saveTemplate() {
  normalizeSortOrder();
  const payload = structuredClone(activeTemplate);
  payload.name = String(payload.name || "").trim();

  if (!payload.name) {
    showPageError("Template name is required.");
    return;
  }

  if (!payload.sections.length) {
    showPageError("Add at least one section.");
    return;
  }

  for (const section of payload.sections) {
    section.title = String(section.title || "").trim();

    if (!section.title) {
      showPageError("Every section needs a title.");
      return;
    }

    for (const field of section.fields) {
      field.label = String(field.label || "").trim();

      if (!field.label) {
        showPageError("Every field needs a label.");
        return;
      }
    }
  }

  try {
    const response = await fetch("/api/clinical-templates", {
      method: activeTemplate.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to save template.");
    }

    templateStatus.hidden = false;
    templateStatus.className = "es-status success";
    templateStatus.textContent = "Clinical template saved.";

    activeTemplate.id = data.template?.id || activeTemplate.id;
    await loadTemplates();
  } catch (error) {
    showPageError(error.message || "Unable to save template.");
  }
}

async function archiveTemplate() {
  if (!activeTemplate?.id) return;

  if (!confirm("Archive this clinical template? It will no longer be active or publicly available, but historical clinical records will be kept.")) {
    return;
  }

  try {
    const response = await fetch("/api/clinical-templates", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        action: "archive",
        id: activeTemplate.id
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to archive template.");
    }

    templateStatus.hidden = false;
    templateStatus.className = "es-status success";
    templateStatus.textContent = "Clinical template archived.";

    activeTemplate = null;
    await loadTemplates();
    renderEditor();
  } catch (error) {
    showPageError(error.message || "Unable to archive template.");
  }
}

async function togglePublish() {
  if (!activeTemplate?.id) return;

  const shouldPublish = activeTemplate.is_published !== 1;

  try {
    const response = await fetch("/api/forms/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        template_id: activeTemplate.id,
        publish: shouldPublish
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to update publishing.");
    }

    templateStatus.hidden = false;
    templateStatus.className = "es-status success";
    templateStatus.textContent = shouldPublish
      ? "Form published. You can now copy the public link."
      : "Form unpublished.";

    await loadTemplates();
  } catch (error) {
    showPageError(error.message || "Unable to update publishing.");
  }
}

async function copyPublicLink() {
  if (!activeTemplate?.public_token) return;

  const url =
    `${location.origin}/forms/view.html?token=${encodeURIComponent(
      activeTemplate.public_token
    )}`;

  try {
    await navigator.clipboard.writeText(url);

    templateStatus.hidden = false;
    templateStatus.className = "es-status success";
    templateStatus.textContent = "Public form link copied.";
  } catch {
    window.prompt("Copy this public form link:", url);
  }
}

function showPageError(message) {
  templateStatus.hidden = false;
  templateStatus.className = "es-status error";
  templateStatus.textContent = message;
}

function formatTemplateType(value) {
  return {
    consultation: "Consultation",
    patch_test: "Patch test",
    treatment_record: "Treatment record",
    custom: "Custom"
  }[value] || value || "Template";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadTemplates();
