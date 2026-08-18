-- Eselram
-- Migration: 029_consultation_credit.sql
-- A paid completed consultation can be credited once against the next
-- treatment booking or package/course for the same service.

ALTER TABLE appointments
ADD COLUMN consultation_credit_source_appointment_id TEXT;

ALTER TABLE appointments
ADD COLUMN consultation_credit_minor INTEGER NOT NULL DEFAULT 0
CHECK (consultation_credit_minor >= 0);

ALTER TABLE package_sales
ADD COLUMN consultation_credit_source_appointment_id TEXT;

ALTER TABLE package_sales
ADD COLUMN consultation_credit_minor INTEGER NOT NULL DEFAULT 0
CHECK (consultation_credit_minor >= 0);

CREATE INDEX IF NOT EXISTS idx_appointments_consultation_credit_source
ON appointments (
  business_id,
  consultation_credit_source_appointment_id,
  status
);

CREATE INDEX IF NOT EXISTS idx_package_sales_consultation_credit_source
ON package_sales (
  business_id,
  consultation_credit_source_appointment_id,
  status
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('029_consultation_credit');
