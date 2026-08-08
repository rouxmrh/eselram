-- Eselram
-- Migration: 014_clinical_submissions_viewer.sql

CREATE INDEX IF NOT EXISTS idx_clinical_form_submissions_status
ON clinical_form_submissions (business_id, status, submitted_at);

CREATE INDEX IF NOT EXISTS idx_clinical_form_submissions_customer
ON clinical_form_submissions (business_id, customer_id, submitted_at);

CREATE INDEX IF NOT EXISTS idx_clinical_form_submissions_appointment
ON clinical_form_submissions (business_id, appointment_id);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('014_clinical_submissions_viewer');
