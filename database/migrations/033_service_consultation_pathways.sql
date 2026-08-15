-- Eselram
-- Migration: 033_service_consultation_pathways.sql
-- Adds true consultation services and links treatment services to them.

ALTER TABLE services
ADD COLUMN service_type TEXT NOT NULL DEFAULT 'standard'
CHECK (service_type IN ('standard','consultation'));

ALTER TABLE services
ADD COLUMN consultation_service_id TEXT;

CREATE INDEX IF NOT EXISTS idx_services_consultation_service
ON services (
  business_id,
  consultation_service_id
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('033_service_consultation_pathways');
