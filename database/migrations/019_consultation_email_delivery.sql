-- Eselram
-- Migration: 019_consultation_email_delivery.sql
-- Purpose:
-- Track consultation-form email delivery against secure form requests.

ALTER TABLE clinical_form_requests
ADD COLUMN email_status TEXT NOT NULL DEFAULT 'not_sent'
CHECK (
  email_status IN (
    'not_sent',
    'sent',
    'failed'
  )
);

ALTER TABLE clinical_form_requests
ADD COLUMN email_to TEXT;

ALTER TABLE clinical_form_requests
ADD COLUMN email_sent_at TEXT;

ALTER TABLE clinical_form_requests
ADD COLUMN email_provider_id TEXT;

ALTER TABLE clinical_form_requests
ADD COLUMN email_error TEXT;

ALTER TABLE clinical_form_requests
ADD COLUMN email_send_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS
idx_clinical_form_requests_email_status
ON clinical_form_requests (
  business_id,
  email_status,
  created_at
);

INSERT OR IGNORE INTO schema_migrations (
  version
)
VALUES (
  '019_consultation_email_delivery'
);
