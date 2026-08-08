-- Eselram
-- Migration: 012_form_renderer_and_submissions.sql
-- Purpose:
--   Publish clinical templates as branded client forms and store submissions.

ALTER TABLE clinical_templates
ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0;

ALTER TABLE clinical_templates
ADD COLUMN public_token TEXT;

ALTER TABLE clinical_templates
ADD COLUMN published_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS
idx_clinical_templates_public_token
ON clinical_templates (
    public_token
)
WHERE public_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS clinical_form_submissions (
    id TEXT PRIMARY KEY,

    business_id TEXT NOT NULL,
    template_id TEXT NOT NULL,

    customer_id TEXT,
    appointment_id TEXT,

    public_token TEXT,

    submitted_by TEXT NOT NULL DEFAULT 'client'
        CHECK (
            submitted_by IN (
                'client',
                'staff'
            )
        ),

    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (
            status IN (
                'draft',
                'submitted',
                'reviewed'
            )
        ),

    client_name TEXT,
    client_email TEXT,

    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    reviewed_by_user_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (template_id)
        REFERENCES clinical_templates(id)
        ON DELETE CASCADE,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL,

    FOREIGN KEY (reviewed_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clinical_form_answers (
    id TEXT PRIMARY KEY,

    submission_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    template_id TEXT NOT NULL,

    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL,

    value_text TEXT,
    value_json TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES clinical_form_submissions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (template_id)
        REFERENCES clinical_templates(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_form_signatures (
    id TEXT PRIMARY KEY,

    submission_id TEXT NOT NULL,
    business_id TEXT NOT NULL,

    field_key TEXT NOT NULL,
    signature_data_url TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES clinical_form_submissions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_form_uploads (
    id TEXT PRIMARY KEY,

    submission_id TEXT NOT NULL,
    business_id TEXT NOT NULL,

    field_key TEXT NOT NULL,

    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_key TEXT NOT NULL,

    original_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES clinical_form_submissions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_submissions_business
ON clinical_form_submissions (
    business_id,
    submitted_at
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_submissions_template
ON clinical_form_submissions (
    template_id,
    submitted_at
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_answers_submission
ON clinical_form_answers (
    submission_id
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_uploads_submission
ON clinical_form_uploads (
    submission_id
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '012_form_renderer_and_submissions'
);
