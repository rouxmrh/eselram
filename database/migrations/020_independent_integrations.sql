-- Eselram
-- Migration: 020_independent_integrations.sql
-- Purpose:
-- Store each business's own external-service configuration.
-- Secrets are encrypted by the application before being written to D1.

CREATE TABLE IF NOT EXISTS business_integrations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,

    integration_type TEXT NOT NULL,
    provider TEXT NOT NULL,

    encrypted_credentials TEXT,
    config_json TEXT,

    status TEXT NOT NULL DEFAULT 'not_configured'
        CHECK (
            status IN (
                'not_configured',
                'configured',
                'verified',
                'error',
                'disabled'
            )
        ),

    last_tested_at TEXT,
    last_error TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    UNIQUE (
        business_id,
        integration_type
    )
);

CREATE INDEX IF NOT EXISTS
idx_business_integrations_business
ON business_integrations (
    business_id,
    integration_type
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '020_independent_integrations'
);
