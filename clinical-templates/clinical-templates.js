const templateList =
  document.getElementById(
    "templateList"
  );

const templateEditor =
  document.getElementById(
    "templateEditor"
  );

const templateStatus =
  document.getElementById(
    "templateStatus"
  );


let templates = [];
let activeTemplate = null;


document
  .getElementById(
    "newTemplateButton"
  )
  .addEventListener(
    "click",
    createBlankTemplate
  );


/* =======================================================
   Load
   ======================================================= */

async function loadTemplates() {

  try {

    const response =
      await fetch(
        "/api/clinical-templates",
        {
          headers: {
            Accept:
              "application/json"
          },
          cache:
            "no-store"
        }
      );


    if (
      response.status === 401
    ) {

      window.location.href =
        "/auth/login.html";

      return;
    }


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to load clinical templates."
      );
    }


    templates =
      data.templates ||
      [];


    renderTemplateList();


    if (
      activeTemplate
    ) {

      const refreshed =
        templates.find(
          (template) =>
            template.id ===
            activeTemplate.id
        );


      if (refreshed) {

        activeTemplate =
          structuredClone(
            refreshed
          );

        renderEditor();
      }
    }


  } catch (error) {

    showPageError(
      error.message ||
      "Unable to load clinical templates."
    );
  }
}


/* =======================================================
   List
   ======================================================= */

function renderTemplateList() {

  if (
    templates.length === 0
  ) {

    templateList.innerHTML = `
      <div class="es-empty-state">
        <strong>
          No templates yet.
        </strong>

        <span>
          Create your first clinical form.
        </span>
      </div>
    `;

    return;
  }


  templateList.innerHTML =
    templates
      .map(
        (template) => `
          <button
            class="
              es-template-list-button
              ${
                activeTemplate?.id ===
                template.id
                  ? "active"
                  : ""
              }
            "
            type="button"
            data-template-id="${escapeHtml(
              template.id
            )}"
          >

            <strong>
              ${escapeHtml(
                template.name
              )}
            </strong>

            <span>
              ${escapeHtml(
                formatTemplateType(
                  template.template_type
                )
              )}
              ${
                template.is_active === 1
                  ? ""
                  : " · Inactive"
              }
            </span>

          </button>
        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-template-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const template =
              templates.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .templateId
              );


            if (!template) {
              return;
            }


            activeTemplate =
              structuredClone(
                template
              );


            renderTemplateList();

            renderEditor();
          }
        );
      }
    );
}


/* =======================================================
   Blank template
   ======================================================= */

function createBlankTemplate() {

  activeTemplate = {
    id: null,
    name:
      "New clinical template",
    template_type:
      "consultation",
    description:
      "",
    is_active:
      1,
    is_default:
      0,
    sections: [
      {
        id:
          crypto.randomUUID(),
        title:
          "Assessment",
        description:
          "",
        sort_order:
          0,
        fields:
          []
      }
    ]
  };


  renderTemplateList();

  renderEditor();
}


/* =======================================================
   Editor
   ======================================================= */

function renderEditor() {

  if (!activeTemplate) {

    templateEditor.innerHTML = `
      <div class="es-template-editor-empty">

        <strong>
          Select or create a template.
        </strong>

        <span>
          Templates can contain any number of sections and custom fields.
        </span>

      </div>
    `;

    return;
  }


  templateEditor.innerHTML = `
    <div class="es-template-meta">

      <div class="es-panel-header">

        <div>
          <p class="es-eyebrow">
            Template builder
          </p>

          <h2>
            ${escapeHtml(
              activeTemplate.name
            )}
          </h2>
        </div>

        <span class="es-template-badge">
          ${escapeHtml(
            formatTemplateType(
              activeTemplate.template_type
            )
          )}
        </span>

      </div>


      <div class="es-form-grid">

        <label>
          Template name

          <input
            id="templateName"
            type="text"
            value="${escapeHtml(
              activeTemplate.name
            )}"
          >
        </label>


        <label>
          Template type

          <select id="templateType">

            ${templateTypeOption(
              "consultation",
              "Consultation"
            )}

            ${templateTypeOption(
              "patch_test",
              "Patch test"
            )}

            ${templateTypeOption(
              "treatment_record",
              "Treatment record"
            )}

            ${templateTypeOption(
              "custom",
              "Custom"
            )}

          </select>
        </label>

      </div>


      <label>
        Description

        <textarea
          id="templateDescription"
          placeholder="Optional description"
        >${escapeHtml(
          activeTemplate.description ||
          ""
        )}</textarea>
      </label>


      <div class="es-check-grid">

        <label class="es-check-option">

          <input
            id="templateActive"
            type="checkbox"
            ${
              activeTemplate.is_active === 1
                ? "checked"
                : ""
            }
          >

          Template is active

        </label>


        <label class="es-check-option">

          <input
            id="templateDefault"
            type="checkbox"
            ${
              activeTemplate.is_default === 1
                ? "checked"
                : ""
            }
          >

          Make default for this template type

        </label>

      </div>

    </div>


    <div id="templateSections">
      ${renderSections()}
    </div>


    <div class="es-template-footer-actions">

      <button
        id="addSectionButton"
        class="es-secondary-button"
        type="button"
      >
        Add section
      </button>


      <button
        id="saveTemplateButton"
        class="es-button"
        type="button"
      >
        Save template
      </button>


      ${
        activeTemplate.id
          ? `
            <button
              id="deleteTemplateButton"
              class="es-secondary-button"
              type="button"
            >
              Delete template
            </button>
          `
          : ""
      }

    </div>
  `;


  bindEditorEvents();
}


function templateTypeOption(
  value,
  label
) {

  return `
    <option
      value="${value}"
      ${
        activeTemplate.template_type ===
        value
          ? "selected"
          : ""
      }
    >
      ${label}
    </option>
  `;
}


function renderSections() {

  return (
    activeTemplate.sections ||
    []
  )
    .sort(
      (a, b) =>
        Number(
          a.sort_order ||
          0
        ) -
        Number(
          b.sort_order ||
          0
        )
    )
    .map(
      (section, sectionIndex) => `
        <section
          class="es-template-section"
          data-section-index="${sectionIndex}"
        >

          <div class="es-template-section-header">

            <div>

              <label>
                Section title

                <input
                  type="text"
                  data-section-title="${sectionIndex}"
                  value="${escapeHtml(
                    section.title
                  )}"
                >
              </label>


              <label>
                Section description

                <input
                  type="text"
                  data-section-description="${sectionIndex}"
                  value="${escapeHtml(
                    section.description ||
                    ""
                  )}"
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


          <div class="es-template-fields">

            ${
              renderFields(
                section,
                sectionIndex
              )
            }

          </div>

        </section>
      `
    )
    .join("");
}


function renderFields(
  section,
  sectionIndex
) {

  if (
    !section.fields ||
    section.fields.length === 0
  ) {

    return `
      <div class="es-empty-state">
        <strong>
          No fields in this section.
        </strong>

        <span>
          Add a field to begin building the form.
        </span>
      </div>
    `;
  }


  return section.fields
    .sort(
      (a, b) =>
        Number(
          a.sort_order ||
          0
        ) -
        Number(
          b.sort_order ||
          0
        )
    )
    .map(
      (field, fieldIndex) => `
        <div
          class="es-template-field"
          data-field-index="${fieldIndex}"
        >

          <label>
            Field label

            <input
              type="text"
              data-field-label="${sectionIndex}:${fieldIndex}"
              value="${escapeHtml(
                field.label
              )}"
            >
          </label>


          <label>
            Field type

            <select
              data-field-type="${sectionIndex}:${fieldIndex}"
            >

              ${fieldTypeOption(
                field,
                "short_text",
                "Short text"
              )}

              ${fieldTypeOption(
                field,
                "long_text",
                "Long text"
              )}

              ${fieldTypeOption(
                field,
                "yes_no",
                "Yes / No"
              )}

              ${fieldTypeOption(
                field,
                "checkbox",
                "Checkbox"
              )}

              ${fieldTypeOption(
                field,
                "dropdown",
                "Dropdown"
              )}

              ${fieldTypeOption(
                field,
                "date",
                "Date"
              )}

              ${fieldTypeOption(
                field,
                "number",
                "Number"
              )}

            </select>
          </label>


          <label class="es-template-required">

            <input
              type="checkbox"
              data-field-required="${sectionIndex}:${fieldIndex}"
              ${
                field.is_required === 1
                  ? "checked"
                  : ""
              }
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
              value="${escapeHtml(
                field.help_text ||
                ""
              )}"
              placeholder="Optional guidance for staff"
            >
          </label>


          ${
            field.field_type ===
            "dropdown"
              ? `
                <label class="es-template-options">
                  Dropdown choices

                  <input
                    type="text"
                    data-field-options="${sectionIndex}:${fieldIndex}"
                    value="${escapeHtml(
                      (
                        field.options ||
                        []
                      ).join(", ")
                    )}"
                    placeholder="Option 1, Option 2, Option 3"
                  >
                </label>
              `
              : ""
          }

        </div>
      `
    )
    .join("");
}


function fieldTypeOption(
  field,
  value,
  label
) {

  return `
    <option
      value="${value}"
      ${
        field.field_type ===
        value
          ? "selected"
          : ""
      }
    >
      ${label}
    </option>
  `;
}


/* =======================================================
   Editor events
   ======================================================= */

function bindEditorEvents() {

  document
    .getElementById(
      "templateName"
    )
    .addEventListener(
      "input",
      (event) => {
        activeTemplate.name =
          event.target.value;
      }
    );


  document
    .getElementById(
      "templateType"
    )
    .addEventListener(
      "change",
      (event) => {
        activeTemplate.template_type =
          event.target.value;

        renderEditor();
      }
    );


  document
    .getElementById(
      "templateDescription"
    )
    .addEventListener(
      "input",
      (event) => {
        activeTemplate.description =
          event.target.value;
      }
    );


  document
    .getElementById(
      "templateActive"
    )
    .addEventListener(
      "change",
      (event) => {
        activeTemplate.is_active =
          event.target.checked
            ? 1
            : 0;
      }
    );


  document
    .getElementById(
      "templateDefault"
    )
    .addEventListener(
      "change",
      (event) => {
        activeTemplate.is_default =
          event.target.checked
            ? 1
            : 0;
      }
    );


  document
    .querySelectorAll(
      "[data-section-title]"
    )
    .forEach(
      (input) => {

        input.addEventListener(
          "input",
          () => {
            activeTemplate.sections[
              Number(
                input.dataset
                  .sectionTitle
              )
            ].title =
              input.value;
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-section-description]"
    )
    .forEach(
      (input) => {

        input.addEventListener(
          "input",
          () => {
            activeTemplate.sections[
              Number(
                input.dataset
                  .sectionDescription
              )
            ].description =
              input.value;
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-add-field]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const index =
              Number(
                button.dataset
                  .addField
              );


            activeTemplate.sections[
              index
            ].fields.push(
              newField(
                activeTemplate
                  .sections[index]
                  .fields.length
              )
            );


            renderEditor();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-remove-section]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const index =
              Number(
                button.dataset
                  .removeSection
              );


            activeTemplate.sections
              .splice(
                index,
                1
              );


            normalizeSortOrder();

            renderEditor();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-field-label]"
    )
    .forEach(
      (input) => {

        input.addEventListener(
          "input",
          () => {

            const [
              sectionIndex,
              fieldIndex
            ] =
              parsePair(
                input.dataset
                  .fieldLabel
              );


            activeTemplate
              .sections[
                sectionIndex
              ]
              .fields[
                fieldIndex
              ]
              .label =
                input.value;
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-field-type]"
    )
    .forEach(
      (select) => {

        select.addEventListener(
          "change",
          () => {

            const [
              sectionIndex,
              fieldIndex
            ] =
              parsePair(
                select.dataset
                  .fieldType
              );


            activeTemplate
              .sections[
                sectionIndex
              ]
              .fields[
                fieldIndex
              ]
              .field_type =
                select.value;


            renderEditor();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-field-required]"
    )
    .forEach(
      (input) => {

        input.addEventListener(
          "change",
          () => {

            const [
              sectionIndex,
              fieldIndex
            ] =
              parsePair(
                input.dataset
                  .fieldRequired
              );


            activeTemplate
              .sections[
                sectionIndex
              ]
              .fields[
                fieldIndex
              ]
              .is_required =
                input.checked
                  ? 1
                  : 0;
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-field-help]"
    )
    .forEach(
      (input) => {

        input.addEventListener(
          "input",
          () => {

            const [
              sectionIndex,
              fieldIndex
            ] =
              parsePair(
                input.dataset
                  .fieldHelp
              );


            activeTemplate
              .sections[
                sectionIndex
              ]
              .fields[
                fieldIndex
              ]
              .help_text =
                input.value;
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-field-options]"
    )
    .forEach(
      (input) => {

        input.addEventListener(
          "input",
          () => {

            const [
              sectionIndex,
              fieldIndex
            ] =
              parsePair(
                input.dataset
                  .fieldOptions
              );


            activeTemplate
              .sections[
                sectionIndex
              ]
              .fields[
                fieldIndex
              ]
              .options =
                input.value
                  .split(",")
                  .map(
                    (value) =>
                      value.trim()
                  )
                  .filter(Boolean);
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-remove-field]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const [
              sectionIndex,
              fieldIndex
            ] =
              parsePair(
                button.dataset
                  .removeField
              );


            activeTemplate
              .sections[
                sectionIndex
              ]
              .fields
              .splice(
                fieldIndex,
                1
              );


            normalizeSortOrder();

            renderEditor();
          }
        );
      }
    );


  document
    .getElementById(
      "addSectionButton"
    )
    .addEventListener(
      "click",
      () => {

        activeTemplate.sections.push({
          id:
            crypto.randomUUID(),
          title:
            "New section",
          description:
            "",
          sort_order:
            activeTemplate
              .sections
              .length,
          fields:
            []
        });


        renderEditor();
      }
    );


  document
    .getElementById(
      "saveTemplateButton"
    )
    .addEventListener(
      "click",
      saveTemplate
    );


  const deleteButton =
    document.getElementById(
      "deleteTemplateButton"
    );


  if (deleteButton) {

    deleteButton.addEventListener(
      "click",
      deleteTemplate
    );
  }
}


function newField(
  sortOrder
) {

  return {
    id:
      crypto.randomUUID(),
    label:
      "New field",
    field_key:
      "",
    field_type:
      "short_text",
    help_text:
      "",
    placeholder:
      "",
    options:
      [],
    is_required:
      0,
    sort_order:
      sortOrder
  };
}


function normalizeSortOrder() {

  activeTemplate.sections
    .forEach(
      (
        section,
        sectionIndex
      ) => {

        section.sort_order =
          sectionIndex;


        section.fields
          .forEach(
            (
              field,
              fieldIndex
            ) => {

              field.sort_order =
                fieldIndex;
            }
          );
      }
    );
}


function parsePair(
  value
) {

  return value
    .split(":")
    .map(Number);
}


/* =======================================================
   Save / delete
   ======================================================= */

async function saveTemplate() {

  normalizeSortOrder();


  const payload =
    structuredClone(
      activeTemplate
    );


  payload.name =
    String(
      payload.name ||
      ""
    ).trim();


  if (!payload.name) {

    showPageError(
      "Template name is required."
    );

    return;
  }


  if (
    payload.sections.length === 0
  ) {

    showPageError(
      "Add at least one section."
    );

    return;
  }


  for (
    const section of
    payload.sections
  ) {

    section.title =
      String(
        section.title ||
        ""
      ).trim();


    if (!section.title) {

      showPageError(
        "Every section needs a title."
      );

      return;
    }


    for (
      const field of
      section.fields
    ) {

      field.label =
        String(
          field.label ||
          ""
        ).trim();


      if (!field.label) {

        showPageError(
          "Every field needs a label."
        );

        return;
      }
    }
  }


  try {

    const response =
      await fetch(
        "/api/clinical-templates",
        {
          method:
            activeTemplate.id
              ? "PUT"
              : "POST",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to save template."
      );
    }


    templateStatus.hidden =
      false;

    templateStatus.className =
      "es-status success";

    templateStatus.textContent =
      "Clinical template saved.";


    activeTemplate.id =
      data.template?.id ||
      activeTemplate.id;


    await loadTemplates();


  } catch (error) {

    showPageError(
      error.message ||
      "Unable to save template."
    );
  }
}


async function deleteTemplate() {

  if (
    !activeTemplate?.id
  ) {
    return;
  }


  const confirmed =
    window.confirm(
      "Delete this clinical template?"
    );


  if (!confirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        `/api/clinical-templates?id=${encodeURIComponent(
          activeTemplate.id
        )}`,
        {
          method:
            "DELETE",
          headers: {
            Accept:
              "application/json"
          }
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to delete template."
      );
    }


    activeTemplate =
      null;


    await loadTemplates();

    renderEditor();


  } catch (error) {

    showPageError(
      error.message ||
      "Unable to delete template."
    );
  }
}


/* =======================================================
   Helpers
   ======================================================= */

function showPageError(
  message
) {

  templateStatus.hidden =
    false;

  templateStatus.className =
    "es-status error";

  templateStatus.textContent =
    message;
}


function formatTemplateType(
  value
) {

  const values = {
    consultation:
      "Consultation",
    patch_test:
      "Patch test",
    treatment_record:
      "Treatment record",
    custom:
      "Custom"
  };


  return values[value] ||
    value ||
    "Template";
}


function escapeHtml(
  value
) {

  return String(
    value ??
    ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


loadTemplates();
