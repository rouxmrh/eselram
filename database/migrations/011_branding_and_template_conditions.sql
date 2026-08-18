-- Eselram
-- Migration: 011_branding_and_template_conditions.sql
-- Purpose:
--   1. Add business-level branding for client-facing forms.
--   2. Add future-ready conditional display rules to clinical templates.

CREATE TABLE IF NOT EXISTS business_branding (
    business_id TEXT PRIMARY KEY,

    logo_data_url TEXT,

    primary_colour TEXT NOT NULL DEFAULT '#365c50',
    accent_colour TEXT NOT NULL DEFAULT '#6f8079',
    background_colour TEXT NOT NULL DEFAULT '#f5f4ef',
    surface_colour TEXT NOT NULL DEFAULT '#ffffff',
    text_colour TEXT NOT NULL DEFAULT '#18221f',

    form_style TEXT NOT NULL DEFAULT 'soft'
        CHECK (
            form_style IN (
                'light',
                'soft',
                'minimal',
                'dark'
            )
        ),

    logo_position TEXT NOT NULL DEFAULT 'centre'
        CHECK (
            logo_position IN (
                'left',
                'centre'
            )
        ),

    show_business_name INTEGER NOT NULL DEFAULT 1,
    show_contact_details INTEGER NOT NULL DEFAULT 1,

    footer_text TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE
);

ALTER TABLE clinical_template_sections
ADD COLUMN condition_json TEXT;

ALTER TABLE clinical_template_fields
ADD COLUMN condition_json TEXT;

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '011_branding_and_template_conditions'
);
