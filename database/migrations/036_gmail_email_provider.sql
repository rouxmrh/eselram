-- Eselram
-- Migration: 036_gmail_email_provider.sql
-- Purpose:
-- Preserve a buyer-owned Gmail OAuth connection alongside the existing Resend
-- integration, and let the business choose which provider sends automated mail.

CREATE TABLE IF NOT EXISTS business_email_connections (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    provider TEXT NOT NULL
        CHECK (provider IN ('gmail')),
    encrypted_credentials TEXT NOT NULL,
    config_json TEXT,
    status TEXT NOT NULL DEFAULT 'configured'
        CHECK (
            status IN (
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
    UNIQUE (business_id, provider)
);

CREATE INDEX IF NOT EXISTS
idx_business_email_connections_business
ON business_email_connections (
    business_id,
    provider
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('036_gmail_email_provider');
