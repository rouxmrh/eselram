import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";


async function getUserContext(
  request,
  env
) {

  const token =
    readSessionToken(
      request
    );


  if (!token) {
    return null;
  }


  const tokenHash =
    await hashSessionToken(
      token
    );


  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(
      tokenHash
    )
    .first();
}


function unauthorized() {

  return Response.json(
    {
      ok: false,
      error:
        "Authentication required."
    },
    {
      status: 401
    }
  );
}


function badRequest(
  message
) {

  return Response.json(
    {
      ok: false,
      error:
        message
    },
    {
      status: 400
    }
  );
}


const allowedTemplateTypes = [
  "consultation",
  "patch_test",
  "treatment_record",
  "custom"
];


const allowedFieldTypes = [
  "short_text",
  "long_text",
  "yes_no",
  "checkbox",
  "dropdown",
  "date",
  "number"
];


/* =======================================================
   GET
   ======================================================= */

export async function onRequestGet({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const templateRows =
      await env.DB
        .prepare(`
          SELECT
            id,
            name,
            template_type,
            description,
            is_active,
            is_default,
            created_at,
            updated_at

          FROM clinical_templates

          WHERE
            business_id = ?

          ORDER BY
            is_active DESC,
            name COLLATE NOCASE
        `)
        .bind(
          user.business_id
        )
        .all();


    const sectionRows =
      await env.DB
        .prepare(`
          SELECT
            id,
            template_id,
            title,
            description,
            sort_order

          FROM clinical_template_sections

          WHERE
            business_id = ?

          ORDER BY
            sort_order ASC
        `)
        .bind(
          user.business_id
        )
        .all();


    const fieldRows =
      await env.DB
        .prepare(`
          SELECT
            id,
            template_id,
            section_id,
            label,
            field_key,
            field_type,
            help_text,
            placeholder,
            options_json,
            is_required,
            sort_order

          FROM clinical_template_fields

          WHERE
            business_id = ?

          ORDER BY
            sort_order ASC
        `)
        .bind(
          user.business_id
        )
        .all();


    const sectionsByTemplate =
      new Map();


    for (
      const section of
      sectionRows.results ||
      []
    ) {

      sectionsByTemplate.set(
        section.template_id,
        [
          ...(
            sectionsByTemplate.get(
              section.template_id
            ) ||
            []
          ),
          {
            ...section,
            fields:
              []
          }
        ]
      );
    }


    const sectionLookup =
      new Map();


    for (
      const sections of
      sectionsByTemplate.values()
    ) {

      for (
        const section of
        sections
      ) {

        sectionLookup.set(
          section.id,
          section
        );
      }
    }


    for (
      const field of
      fieldRows.results ||
      []
    ) {

      const section =
        sectionLookup.get(
          field.section_id
        );


      if (!section) {
        continue;
      }


      let options = [];


      try {

        options =
          field.options_json
            ? JSON.parse(
                field.options_json
              )
            : [];

      } catch {

        options =
          [];
      }


      section.fields.push({
        ...field,
        options
      });
    }


    const templates =
      (
        templateRows.results ||
        []
      ).map(
        (template) => ({
          ...template,

          sections:
            sectionsByTemplate.get(
              template.id
            ) ||
            []
        })
      );


    return Response.json({
      ok: true,
      templates
    });


  } catch (error) {

    console.error(
      "Clinical templates GET failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load clinical templates."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   POST
   ======================================================= */

export async function onRequestPost({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const body =
      await request.json();


    const validation =
      validateTemplate(
        body
      );


    if (!validation.ok) {

      return badRequest(
        validation.error
      );
    }


    const templateId =
      `ct_${
        crypto.randomUUID()
      }`;


    await saveTemplateStructure({
      env,
      businessId:
        user.business_id,
      templateId,
      payload:
        validation.payload,
      isUpdate:
        false
    });


    return Response.json({
      ok: true,
      template: {
        id:
          templateId
      }
    });


  } catch (error) {

    console.error(
      "Clinical template creation failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to create clinical template."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   PUT
   ======================================================= */

export async function onRequestPut({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const body =
      await request.json();


    const templateId =
      String(
        body.id ||
        ""
      ).trim();


    if (!templateId) {

      return badRequest(
        "Template id is required."
      );
    }


    const existing =
      await env.DB
        .prepare(`
          SELECT id

          FROM clinical_templates

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `)
        .bind(
          templateId,
          user.business_id
        )
        .first();


    if (!existing) {

      return Response.json(
        {
          ok: false,
          error:
            "Clinical template not found."
        },
        {
          status: 404
        }
      );
    }


    const validation =
      validateTemplate(
        body
      );


    if (!validation.ok) {

      return badRequest(
        validation.error
      );
    }


    await saveTemplateStructure({
      env,
      businessId:
        user.business_id,
      templateId,
      payload:
        validation.payload,
      isUpdate:
        true
    });


    return Response.json({
      ok: true,
      template: {
        id:
          templateId
      }
    });


  } catch (error) {

    console.error(
      "Clinical template update failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to update clinical template."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   DELETE
   ======================================================= */

export async function onRequestDelete({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const url =
      new URL(
        request.url
      );


    const id =
      String(
        url.searchParams.get(
          "id"
        ) ||
        ""
      ).trim();


    if (!id) {

      return badRequest(
        "Template id is required."
      );
    }


    await env.DB
      .prepare(`
        DELETE FROM clinical_templates

        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        id,
        user.business_id
      )
      .run();


    return Response.json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Clinical template deletion failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to delete clinical template."
      },
      {
        status: 500
      }
    );
  }
}


/* =======================================================
   Save helpers
   ======================================================= */

async function saveTemplateStructure({
  env,
  businessId,
  templateId,
  payload,
  isUpdate
}) {

  const statements = [];


  if (
    payload.is_default === 1
  ) {

    statements.push(
      env.DB
        .prepare(`
          UPDATE clinical_templates

          SET
            is_default = 0,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            business_id = ?
            AND template_type = ?
            AND id != ?
        `)
        .bind(
          businessId,
          payload.template_type,
          templateId
        )
    );
  }


  if (isUpdate) {

    statements.push(
      env.DB
        .prepare(`
          UPDATE clinical_templates

          SET
            name = ?,
            template_type = ?,
            description = ?,
            is_active = ?,
            is_default = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          payload.name,
          payload.template_type,
          payload.description ||
            null,
          payload.is_active,
          payload.is_default,
          templateId,
          businessId
        )
    );


    statements.push(
      env.DB
        .prepare(`
          DELETE FROM clinical_template_fields

          WHERE
            template_id = ?
            AND business_id = ?
        `)
        .bind(
          templateId,
          businessId
        )
    );


    statements.push(
      env.DB
        .prepare(`
          DELETE FROM clinical_template_sections

          WHERE
            template_id = ?
            AND business_id = ?
        `)
        .bind(
          templateId,
          businessId
        )
    );

  } else {

    statements.push(
      env.DB
        .prepare(`
          INSERT INTO clinical_templates (
            id,
            business_id,
            name,
            template_type,
            description,
            is_active,
            is_default
          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?
          )
        `)
        .bind(
          templateId,
          businessId,
          payload.name,
          payload.template_type,
          payload.description ||
            null,
          payload.is_active,
          payload.is_default
        )
    );
  }


  for (
    let sectionIndex = 0;
    sectionIndex <
      payload.sections.length;
    sectionIndex += 1
  ) {

    const section =
      payload.sections[
        sectionIndex
      ];


    const sectionId =
      `cts_${
        crypto.randomUUID()
      }`;


    statements.push(
      env.DB
        .prepare(`
          INSERT INTO clinical_template_sections (
            id,
            business_id,
            template_id,
            title,
            description,
            sort_order
          )

          VALUES (
            ?, ?, ?, ?, ?, ?
          )
        `)
        .bind(
          sectionId,
          businessId,
          templateId,
          section.title,
          section.description ||
            null,
          sectionIndex
        )
    );


    for (
      let fieldIndex = 0;
      fieldIndex <
        section.fields.length;
      fieldIndex += 1
    ) {

      const field =
        section.fields[
          fieldIndex
        ];


      const fieldId =
        `ctf_${
          crypto.randomUUID()
        }`;


      const fieldKey =
        makeFieldKey(
          field.label,
          sectionIndex,
          fieldIndex
        );


      statements.push(
        env.DB
          .prepare(`
            INSERT INTO clinical_template_fields (
              id,
              business_id,
              template_id,
              section_id,
              label,
              field_key,
              field_type,
              help_text,
              placeholder,
              options_json,
              is_required,
              sort_order
            )

            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?
            )
          `)
          .bind(
            fieldId,
            businessId,
            templateId,
            sectionId,
            field.label,
            fieldKey,
            field.field_type,
            field.help_text ||
              null,
            field.placeholder ||
              null,
            field.field_type ===
              "dropdown"
              ? JSON.stringify(
                  field.options ||
                  []
                )
              : null,
            field.is_required,
            fieldIndex
          )
      );
    }
  }


  await env.DB.batch(
    statements
  );
}


function validateTemplate(
  body
) {

  const name =
    String(
      body.name ||
      ""
    ).trim();

  const templateType =
    String(
      body.template_type ||
      ""
    ).trim();

  const description =
    String(
      body.description ||
      ""
    ).trim();

  const isActive =
    body.is_active === 0
      ? 0
      : 1;

  const isDefault =
    body.is_default === 1
      ? 1
      : 0;

  const sections =
    Array.isArray(
      body.sections
    )
      ? body.sections
      : [];


  if (!name) {

    return {
      ok: false,
      error:
        "Template name is required."
    };
  }


  if (
    !allowedTemplateTypes.includes(
      templateType
    )
  ) {

    return {
      ok: false,
      error:
        "Invalid template type."
    };
  }


  if (
    sections.length === 0
  ) {

    return {
      ok: false,
      error:
        "Add at least one section."
    };
  }


  const cleanSections = [];


  for (
    const section of
    sections
  ) {

    const title =
      String(
        section.title ||
        ""
      ).trim();


    if (!title) {

      return {
        ok: false,
        error:
          "Every section needs a title."
      };
    }


    const fields =
      Array.isArray(
        section.fields
      )
        ? section.fields
        : [];


    const cleanFields = [];


    for (
      const field of
      fields
    ) {

      const label =
        String(
          field.label ||
          ""
        ).trim();

      const fieldType =
        String(
          field.field_type ||
          ""
        ).trim();


      if (!label) {

        return {
          ok: false,
          error:
            "Every field needs a label."
        };
      }


      if (
        !allowedFieldTypes.includes(
          fieldType
        )
      ) {

        return {
          ok: false,
          error:
            "Invalid field type."
        };
      }


      cleanFields.push({
        label,
        field_type:
          fieldType,
        help_text:
          String(
            field.help_text ||
            ""
          ).trim(),
        placeholder:
          String(
            field.placeholder ||
            ""
          ).trim(),
        options:
          fieldType ===
            "dropdown" &&
          Array.isArray(
            field.options
          )
            ? field.options
                .map(
                  (value) =>
                    String(value)
                      .trim()
                )
                .filter(Boolean)
            : [],
        is_required:
          field.is_required === 1
            ? 1
            : 0
      });
    }


    cleanSections.push({
      title,
      description:
        String(
          section.description ||
          ""
        ).trim(),
      fields:
        cleanFields
    });
  }


  return {
    ok: true,

    payload: {
      name,
      template_type:
        templateType,
      description,
      is_active:
        isActive,
      is_default:
        isDefault,
      sections:
        cleanSections
    }
  };
}


function makeFieldKey(
  label,
  sectionIndex,
  fieldIndex
) {

  const base =
    String(label)
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      )
      .slice(
        0,
        42
      ) ||
    "field";


  return `${base}_${
    sectionIndex + 1
  }_${
    fieldIndex + 1
  }`;
}
