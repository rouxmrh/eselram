-- Eselram
-- Migration: 010_clinical_templates.sql
-- Purpose: Configurable clinical form templates per business.

CREATE TABLE IF NOT EXISTS clinical_templates (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,

    name TEXT NOT NULL,

    template_type TEXT NOT NULL
        CHECK (
            template_type IN (
                'consultation',
                'patch_test',
                'treatment_record',
                'custom'
            )
        ),

    description TEXT,

    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_template_sections (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    template_id TEXT NOT NULL,

    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (template_id)
        REFERENCES clinical_templates(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clinical_template_fields (
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
                'number'
            )
        ),

    help_text TEXT,
    placeholder TEXT,
    options_json TEXT,

    is_required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

CREATE INDEX IF NOT EXISTS
idx_clinical_templates_business
ON clinical_templates (
    business_id,
    template_type,
    is_active
);

CREATE INDEX IF NOT EXISTS
idx_clinical_template_sections_template
ON clinical_template_sections (
    template_id,
    sort_order
);

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
    '010_clinical_templates'
);
