-- Eselram
-- Migration: 009_treatment_records.sql
-- Purpose: Add flexible clinical treatment records linked to
--          customers, appointments, services and practitioners.

CREATE TABLE IF NOT EXISTS treatment_records (
    id TEXT PRIMARY KEY,

    business_id TEXT NOT NULL,
    appointment_id TEXT,
    customer_id TEXT NOT NULL,
    service_id TEXT,
    practitioner_user_id TEXT,

    status TEXT NOT NULL DEFAULT 'complete'
        CHECK (
            status IN (
                'draft',
                'complete'
            )
        ),

    treatment_date TEXT NOT NULL,

    practitioner_name TEXT,

    treatment_area TEXT,

    device_name TEXT,
    device_settings TEXT,

    treatment_notes TEXT,
    client_response TEXT,
    client_tolerance TEXT,

    aftercare_notes TEXT,

    next_session_plan TEXT,
    next_treatment_date TEXT,

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
        ON DELETE CASCADE,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE SET NULL,

    FOREIGN KEY (practitioner_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS
idx_treatment_records_appointment_unique
ON treatment_records (
    appointment_id
)
WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
idx_treatment_records_customer
ON treatment_records (
    business_id,
    customer_id,
    treatment_date
);

CREATE INDEX IF NOT EXISTS
idx_treatment_records_service
ON treatment_records (
    business_id,
    service_id,
    treatment_date
);

CREATE INDEX IF NOT EXISTS
idx_treatment_records_status
ON treatment_records (
    business_id,
    status
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '009_treatment_records'
);

