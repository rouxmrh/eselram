-- Eselram
-- Migration: 003_payment_providers.sql
-- Purpose: Provider-independent payments architecture

CREATE TABLE IF NOT EXISTS payment_providers (
    provider_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,

    provider_type TEXT NOT NULL
        CHECK (provider_type IN ('online', 'manual')),

    supports_deposits INTEGER NOT NULL DEFAULT 1
        CHECK (supports_deposits IN (0, 1)),

    supports_refunds INTEGER NOT NULL DEFAULT 1
        CHECK (supports_refunds IN (0, 1)),

    is_available INTEGER NOT NULL DEFAULT 1
        CHECK (is_available IN (0, 1)),

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO payment_providers (
    provider_key,
    display_name,
    provider_type,
    supports_deposits,
    supports_refunds,
    sort_order
)
VALUES
    ('stripe', 'Stripe', 'online', 1, 1, 10),
    ('paypal', 'PayPal', 'online', 1, 1, 20),
    ('sumup', 'SumUp', 'online', 1, 1, 30),
    ('square', 'Square', 'online', 1, 1, 40),
    ('manual', 'Pay at appointment', 'manual', 1, 0, 50);


CREATE TABLE IF NOT EXISTS business_payment_providers (
    id TEXT PRIMARY KEY,

    business_id TEXT NOT NULL,
    provider_key TEXT NOT NULL,

    is_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (is_enabled IN (0, 1)),

    is_default INTEGER NOT NULL DEFAULT 0
        CHECK (is_default IN (0, 1)),

    connection_status TEXT NOT NULL DEFAULT 'not_connected'
        CHECK (
            connection_status IN (
                'not_connected',
                'connected',
                'attention_required',
                'error'
            )
        ),

    environment TEXT NOT NULL DEFAULT 'live'
        CHECK (
            environment IN (
                'sandbox',
                'live'
            )
        ),

    external_account_reference TEXT,

    webhook_status TEXT NOT NULL DEFAULT 'not_configured'
        CHECK (
            webhook_status IN (
                'not_configured',
                'configured',
                'error'
            )
        ),

    last_sync_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (provider_key)
        REFERENCES payment_providers(provider_key)
        ON DELETE RESTRICT,

    UNIQUE (business_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_business_payment_providers
ON business_payment_providers (
    business_id,
    provider_key
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('003_payment_providers');
