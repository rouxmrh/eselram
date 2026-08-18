-- Eselram
-- Migration: 027_automated_communications.sql
-- Extends the existing communications log for forms and payment/package emails.

PRAGMA foreign_keys = OFF;

CREATE TABLE customer_communications_new (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    appointment_id TEXT,
    customer_id TEXT,
    payment_id TEXT,
    form_request_id TEXT,
    customer_package_id TEXT,

    communication_type TEXT NOT NULL
        CHECK (
            communication_type IN (
                'booking_confirmation',
                'appointment_reminder',
                'cancellation_confirmation',
                'reschedule_confirmation',
                'client_form_request',
                'client_form_reminder',
                'payment_receipt',
                'package_payment_confirmation'
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
        ON DELETE SET NULL,

    FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE SET NULL,

    FOREIGN KEY (form_request_id)
        REFERENCES clinical_form_requests(id)
        ON DELETE SET NULL,

    FOREIGN KEY (customer_package_id)
        REFERENCES customer_packages(id)
        ON DELETE SET NULL
);

INSERT INTO customer_communications_new (
    id,
    business_id,
    appointment_id,
    customer_id,
    communication_type,
    recipient,
    subject,
    status,
    provider,
    provider_reference,
    unique_key,
    scheduled_for,
    sent_at,
    error_details,
    created_at,
    updated_at
)
SELECT
    id,
    business_id,
    appointment_id,
    customer_id,
    communication_type,
    recipient,
    subject,
    status,
    provider,
    provider_reference,
    unique_key,
    scheduled_for,
    sent_at,
    error_details,
    created_at,
    updated_at
FROM customer_communications;

DROP TABLE customer_communications;

ALTER TABLE customer_communications_new
RENAME TO customer_communications;

CREATE INDEX IF NOT EXISTS idx_customer_communications_business
ON customer_communications (business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_communications_appointment
ON customer_communications (appointment_id, communication_type);

CREATE INDEX IF NOT EXISTS idx_customer_communications_customer
ON customer_communications (business_id, customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_communications_payment
ON customer_communications (payment_id, communication_type);

CREATE INDEX IF NOT EXISTS idx_customer_communications_form
ON customer_communications (form_request_id, communication_type);

CREATE INDEX IF NOT EXISTS idx_customer_communications_status
ON customer_communications (business_id, status, scheduled_for);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('027_automated_communications');

PRAGMA foreign_keys = ON;
