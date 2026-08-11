-- Eselram
-- Migration: 024_customer_photos.sql
-- Purpose:
-- Keep photos permanently against the customer while optionally
-- linking them to an appointment, service or treatment record.

CREATE TABLE IF NOT EXISTS customer_photos (
    id TEXT PRIMARY KEY,

    business_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,

    appointment_id TEXT,
    service_id TEXT,
    treatment_record_id TEXT,

    photo_type TEXT NOT NULL DEFAULT 'other'
        CHECK (
            photo_type IN (
                'before',
                'after',
                'progress',
                'consultation',
                'patch_test',
                'other'
            )
        ),

    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_key TEXT NOT NULL,

    original_name TEXT,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,

    taken_at TEXT,
    notes TEXT,

    uploaded_by_user_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE SET NULL,

    FOREIGN KEY (treatment_record_id)
        REFERENCES treatment_records(id)
        ON DELETE SET NULL,

    FOREIGN KEY (uploaded_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS
idx_customer_photos_customer
ON customer_photos (
    business_id,
    customer_id,
    created_at
);

CREATE INDEX IF NOT EXISTS
idx_customer_photos_appointment
ON customer_photos (
    business_id,
    appointment_id
);

CREATE INDEX IF NOT EXISTS
idx_customer_photos_treatment
ON customer_photos (
    business_id,
    treatment_record_id
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '024_customer_photos'
);
