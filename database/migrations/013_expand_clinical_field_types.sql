-- Eselram
-- Migration: 013_expand_clinical_field_types.sql
-- Purpose:
-- Expand clinical_template_fields.field_type to support
-- signature and file_upload while preserving existing records.
--
-- IMPORTANT:
-- This migration is for repository history / future clean installs.
-- Do NOT rerun it on a live database where it has already been applied.

PRAGMA foreign_keys = OFF;

CREATE TABLE clinical_template_fields_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    section_id TEXT NOT NULL,

    label TEXT NOT NULL,
    field_key TEXT NOT NULL,

    field_type TEXT NOT NULL
        CHECK (
            field_type IN (
                'short_text',
                'long_text',
                'yes_no',
                'checkbox',
                'dropdown',
                'date',
                'number',
                'signature',
                'file_upload'
            )
        ),

    help_text TEXT,
    placeholder TEXT,
    options_json TEXT,

    is_required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    condition_json TEXT,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (template_id)
        REFERENCES clinical_templates(id)
        ON DELETE CASCADE,

    FOREIGN KEY (section_id)
        REFERENCES clinical_template_sections(id)
        ON DELETE CASCADE
);

INSERT INTO clinical_template_fields_new (
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
    sort_order,
    created_at,
    updated_at,
    condition_json
)
SELECT
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
    sort_order,
    created_at,
    updated_at,
    condition_json
FROM clinical_template_fields;

DROP TABLE clinical_template_fields;

ALTER TABLE clinical_template_fields_new
RENAME TO clinical_template_fields;

CREATE INDEX IF NOT EXISTS
idx_clinical_template_fields_section
ON clinical_template_fields (
    section_id,
    sort_order
);

CREATE UNIQUE INDEX IF NOT EXISTS
idx_clinical_template_field_key
ON clinical_template_fields (
    template_id,
    field_key
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '013_expand_clinical_field_types'
);

PRAGMA foreign_keys = ON;

