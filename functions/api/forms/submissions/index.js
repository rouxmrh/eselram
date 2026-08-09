export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") || "").trim();
    const requestToken = String(
      form.get("request_token") || ""
    ).trim();

    if (!token && !requestToken) {
      return Response.json(
        { ok: false, error: "Form token is required." },
        { status: 400 }
      );
    }

    let formRequest = null;
    let template = null;

    if (requestToken) {
      formRequest = await env.DB
        .prepare(`
          SELECT
            r.id AS request_id,
            r.business_id,
            r.template_id,
            r.customer_id,
            r.appointment_id,
            r.status AS request_status,
            r.expires_at,

            t.name,
            t.template_type,
            t.description,
            t.version

          FROM clinical_form_requests r

          JOIN clinical_templates t
            ON t.id = r.template_id

          WHERE
            r.request_token = ?
            AND r.status IN ('created', 'opened')
            AND datetime(r.expires_at) > datetime('now')
            AND t.is_published = 1
            AND t.is_active = 1

          LIMIT 1
        `)
        .bind(requestToken)
        .first();

      if (formRequest) {
        template = {
          id: formRequest.template_id,
          business_id: formRequest.business_id,
          name: formRequest.name,
          template_type: formRequest.template_type,
          description: formRequest.description,
          version: formRequest.version
        };
      }
    } else {
      template = await env.DB
        .prepare(`
          SELECT
            id,
            business_id,
            name,
            template_type,
            description,
            version
          FROM clinical_templates
          WHERE
            public_token = ?
            AND is_published = 1
            AND is_active = 1
          LIMIT 1
        `)
        .bind(token)
        .first();
    }

    if (!template) {
      return Response.json(
        { ok: false, error: "Form is not available or has already been submitted." },
        { status: 404 }
      );
    }

    const [sectionRows, fieldRows] = await Promise.all([
      env.DB
        .prepare(`
          SELECT
            id,
            title,
            description,
            sort_order,
            condition_json
          FROM clinical_template_sections
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `)
        .bind(template.business_id, template.id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            section_id,
            label,
            field_key,
            field_type,
            help_text,
            placeholder,
            options_json,
            is_required,
            sort_order,
            condition_json
          FROM clinical_template_fields
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `)
        .bind(template.business_id, template.id)
        .all()
    ]);

    const fields = fieldRows.results || [];
    const fieldMap = new Map(fields.map(field => [field.field_key, field]));

    const fieldsBySection = new Map();
    for (const field of fields) {
      fieldsBySection.set(
        field.section_id,
        [
          ...(fieldsBySection.get(field.section_id) || []),
          {
            label: field.label,
            field_key: field.field_key,
            field_type: field.field_type,
            help_text: field.help_text,
            placeholder: field.placeholder,
            options: parseJson(field.options_json, []),
            is_required: field.is_required,
            sort_order: field.sort_order,
            condition: parseJson(field.condition_json, null)
          }
        ]
      );
    }

    const templateSnapshot = {
      id: template.id,
      name: template.name,
      template_type: template.template_type,
      description: template.description || null,
      version: Number(template.version || 1),
      sections: (sectionRows.results || []).map(section => ({
        title: section.title,
        description: section.description || null,
        sort_order: section.sort_order,
        condition: parseJson(section.condition_json, null),
        fields: fieldsBySection.get(section.id) || []
      }))
    };

    const answers = new Map();
    const signatures = new Map();
    const uploads = new Map();

    for (const [key, value] of form.entries()) {
      if (key.startsWith("answer:")) {
        answers.set(key.slice(7), String(value || ""));
      } else if (key.startsWith("signature:")) {
        signatures.set(key.slice(10), String(value || ""));
      } else if (key.startsWith("file:") && value instanceof File) {
        const fieldKey = key.slice(5);
        uploads.set(
          fieldKey,
          [
            ...(uploads.get(fieldKey) || []),
            value
          ]
        );
      }
    }

    for (const field of fields) {
      if (field.is_required !== 1) continue;

      if (!isConditionSatisfied(field.condition_json, answers)) {
        continue;
      }

      if (field.field_type === "signature") {
        if (!signatures.get(field.field_key)) {
          return Response.json(
            { ok: false, error: `${field.label} is required.` },
            { status: 400 }
          );
        }
        continue;
      }

      if (field.field_type === "file_upload") {
        if (!(uploads.get(field.field_key) || []).length) {
          return Response.json(
            { ok: false, error: `${field.label} is required.` },
            { status: 400 }
          );
        }
        continue;
      }

      const value = String(answers.get(field.field_key) || "").trim();

      if (!value || (field.field_type === "checkbox" && value !== "Yes")) {
        return Response.json(
          { ok: false, error: `${field.label} is required.` },
          { status: 400 }
        );
      }
    }

    const hasUploads = Array.from(uploads.values()).some(files => files.length > 0);

    if (hasUploads && !env.FORM_UPLOADS) {
      return Response.json(
        {
          ok: false,
          error:
            "This form includes file uploads, but FORM_UPLOADS storage is not configured yet."
        },
        { status: 503 }
      );
    }

    const submissionId = `cfs_${crypto.randomUUID()}`;

    const statements = [
      env.DB
        .prepare(`
          INSERT INTO clinical_form_submissions (
            id,
            business_id,
            template_id,
            customer_id,
            appointment_id,
            form_request_id,
            public_token,
            submitted_by,
            status,
            template_version,
            template_snapshot_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            'client',
            'submitted',
            ?, ?
          )
        `)
        .bind(
          submissionId,
          template.business_id,
          template.id,
          formRequest?.customer_id || null,
          formRequest?.appointment_id || null,
          formRequest?.request_id || null,
          requestToken || token,
          Number(template.version || 1),
          JSON.stringify(templateSnapshot)
        )
    ];

    for (const [fieldKey, value] of answers.entries()) {
      const field = fieldMap.get(fieldKey);
      if (!field) continue;

      statements.push(
        env.DB
          .prepare(`
            INSERT INTO clinical_form_answers (
              id,
              submission_id,
              business_id,
              template_id,
              field_key,
              field_label,
              field_type,
              value_text
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            `cfa_${crypto.randomUUID()}`,
            submissionId,
            template.business_id,
            template.id,
            fieldKey,
            field.label,
            field.field_type,
            value
          )
      );
    }

    for (const [fieldKey, signatureData] of signatures.entries()) {
      const field = fieldMap.get(fieldKey);
      if (!field || field.field_type !== "signature") continue;

      if (!/^data:image\/png;base64,/i.test(signatureData)) {
        return Response.json(
          { ok: false, error: "Invalid signature data." },
          { status: 400 }
        );
      }

      if (signatureData.length > 700000) {
        return Response.json(
          { ok: false, error: "Signature is too large." },
          { status: 400 }
        );
      }

      statements.push(
        env.DB
          .prepare(`
            INSERT INTO clinical_form_signatures (
              id,
              submission_id,
              business_id,
              field_key,
              signature_data_url
            )
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(
            `cfsig_${crypto.randomUUID()}`,
            submissionId,
            template.business_id,
            fieldKey,
            signatureData
          )
      );
    }

    await env.DB.batch(statements);

    for (const [fieldKey, files] of uploads.entries()) {
      const field = fieldMap.get(fieldKey);
      if (!field || field.field_type !== "file_upload") continue;

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          return Response.json(
            { ok: false, error: `${file.name} is larger than 5 MB.` },
            { status: 400 }
          );
        }

        if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
          return Response.json(
            { ok: false, error: `${file.name} has an unsupported file type.` },
            { status: 400 }
          );
        }

        const safeName = String(file.name || "upload")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(0, 100);

        const storageKey =
          `${template.business_id}/${submissionId}/${fieldKey}/${crypto.randomUUID()}-${safeName}`;

        await env.FORM_UPLOADS.put(
          storageKey,
          await file.arrayBuffer(),
          { httpMetadata: { contentType: file.type || "application/octet-stream" } }
        );

        await env.DB
          .prepare(`
            INSERT INTO clinical_form_uploads (
              id,
              submission_id,
              business_id,
              field_key,
              storage_provider,
              storage_key,
              original_name,
              mime_type,
              size_bytes
            )
            VALUES (?, ?, ?, ?, 'r2', ?, ?, ?, ?)
          `)
          .bind(
            `cfu_${crypto.randomUUID()}`,
            submissionId,
            template.business_id,
            fieldKey,
            storageKey,
            file.name || safeName,
            file.type || null,
            file.size
          )
          .run();
      }
    }

    if (formRequest?.request_id) {
      await env.DB
        .prepare(`
          UPDATE clinical_form_requests
          SET
            status = 'submitted',
            submission_id = ?,
            submitted_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND status IN ('created', 'opened')
        `)
        .bind(
          submissionId,
          formRequest.request_id
        )
        .run();
    }

    return Response.json({
      ok: true,
      submission_id: submissionId
    });
  } catch (error) {
    console.error("Clinical form submission failed:", error);

    return Response.json(
      { ok: false, error: "Unable to submit form." },
      { status: 500 }
    );
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isConditionSatisfied(conditionJson, answers) {
  if (!conditionJson) return true;

  let condition = null;

  try {
    condition = JSON.parse(conditionJson);
  } catch {
    return true;
  }

  if (!condition?.field_key) return true;

  const current = String(answers.get(condition.field_key) || "");
  const expected = String(condition.value || "");

  return condition.operator === "not_equals"
    ? current !== expected
    : current === expected;
}
