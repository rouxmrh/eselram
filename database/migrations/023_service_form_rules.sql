-- Eselram
-- Migration: 023_service_form_rules.sql

CREATE TABLE IF NOT EXISTS service_form_rules (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    trigger_event TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_event IN ('payment_received','booking_confirmed','manual')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES clinical_templates(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_form_rules_unique ON service_form_rules (business_id,service_id,template_id);
CREATE INDEX IF NOT EXISTS idx_service_form_rules_trigger ON service_form_rules (business_id,service_id,trigger_event,is_active);
INSERT OR IGNORE INTO schema_migrations (version) VALUES ('023_service_form_rules');
