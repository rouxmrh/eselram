-- Eselram
-- Migration: 008_provider_independent_payments.sql
-- Purpose: Remove the legacy provider CHECK constraint so payments can
--          store PayPal, SumUp, Square and future provider keys.

PRAGMA foreign_keys = OFF;

CREATE TABLE payments_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    appointment_id TEXT,
    customer_id TEXT,

    provider TEXT NOT NULL,

    payment_type TEXT NOT NULL
        CHECK (
            payment_type IN (
                'full',
                'deposit',
                'balance',
                'pay_at_appointment',
                'refund'
            )
        ),

    amount_minor INTEGER NOT NULL DEFAULT 0,

    currency TEXT NOT NULL DEFAULT 'GBP',

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'paid',
                'failed',
                'refunded',
                'partially_refunded',
                'due'
            )
        ),

    provider_reference TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    payment_method TEXT,
    notes TEXT,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL
);

INSERT INTO payments_new (
    id,
    business_id,
    appointment_id,
    customer_id,
    provider,
    payment_type,
    amount_minor,
    currency,
    status,
    provider_reference,
    paid_at,
    created_at,
    updated_at,
    payment_method,
    notes
)
SELECT
    id,
    business_id,
    appointment_id,
    customer_id,
    provider,
    payment_type,
    amount_minor,
    currency,
    status,
    provider_reference,
    paid_at,
    created_at,
    updated_at,
    payment_method,
    notes
FROM payments;

DROP TABLE payments;

ALTER TABLE payments_new
RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_appointment
ON payments (
    appointment_id
);

CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
ON payments (
    provider,
    provider_reference
);

CREATE INDEX IF NOT EXISTS idx_payments_payment_method
ON payments (
    payment_method
);

CREATE INDEX IF NOT EXISTS idx_payments_customer
ON payments (
    customer_id,
    created_at
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '008_provider_independent_payments'
);

PRAGMA foreign_keys = ON;
