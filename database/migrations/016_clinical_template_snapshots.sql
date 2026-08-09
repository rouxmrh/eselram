-- Eselram
-- Migration: 016_clinical_template_snapshots.sql
-- Purpose: Freeze the template structure/version used for each new clinical submission.

ALTER TABLE clinical_templates
ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE clinical_form_submissions
ADD COLUMN template_version INTEGER;

ALTER TABLE clinical_form_submissions
ADD COLUMN template_snapshot_json TEXT;

UPDATE clinical_form_submissions
SET template_version = 1
WHERE template_version IS NULL;

INSERT OR IGNORE INTO schema_migrations (
  version
)
VALUES (
  '016_clinical_template_snapshots'
);
