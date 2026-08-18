-- Eselram
-- Migration: 021_customer_communications.sql
-- Purpose:
-- Log customer communications and support idempotent confirmations/reminders.

CREATE TABLE IF NOT EXISTS customer_communications (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    appointment_id TEXT,
    customer_id TEXT,

    communication_type TEXT NOT NULL
        CHECK (
            communication_type IN (
                'booking_confirmation',
                'appointment_reminder',
                'cancellation_confirmation',
                'reschedule_confirmation'
            )
        ),

    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'sent',
                'failed',
                'skipped'
            )
        ),

    provider TEXT NOT NULL DEFAULT 'resend',
    provider_reference TEXT,

    unique_key TEXT NOT NULL UNIQUE,

    scheduled_for TEXT,
    sent_at TEXT,
    error_details TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

CREATE INDEX IF NOT EXISTS
idx_customer_communications_business
ON customer_communications (
    business_id,
    created_at
);

CREATE INDEX IF NOT EXISTS
idx_customer_communications_appointment
ON customer_communications (
    appointment_id,
    communication_type
);

CREATE INDEX IF NOT EXISTS
idx_customer_communications_status
ON customer_communications (
    business_id,
    status,
    scheduled_for
);

INSERT OR IGNORE INTO schema_migrations (
  version
)
VALUES (
  '021_customer_communications'
);
