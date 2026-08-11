-- Eselram
-- Migration: 022_customer_self_service.sql

CREATE TABLE IF NOT EXISTS appointment_manage_tokens (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    appointment_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_appointment_manage_tokens_appointment
ON appointment_manage_tokens (business_id, appointment_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_appointment_manage_tokens_customer
ON appointment_manage_tokens (business_id, customer_id, expires_at);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('022_customer_self_service');
