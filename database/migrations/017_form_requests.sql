-- Eselram
-- Migration: 017_form_requests.sql
-- Purpose:
-- Create secure customer / appointment-linked form requests.
-- A form request generates a one-time client link and automatically
-- links the completed clinical submission to the correct customer
-- and, when supplied, appointment.

CREATE TABLE IF NOT EXISTS clinical_form_requests (
    id TEXT PRIMARY KEY,

    business_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    appointment_id TEXT,

    request_token TEXT NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'created'
        CHECK (
            status IN (
                'created',
                'opened',
                'submitted',
                'revoked'
            )
        ),

    created_by_user_id TEXT,
    submission_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opened_at TEXT,
    submitted_at TEXT,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (template_id)
        REFERENCES clinical_templates(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL,

    FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (submission_id)
        REFERENCES clinical_form_submissions(id)
        ON DELETE SET NULL
);

ALTER TABLE clinical_form_submissions
ADD COLUMN form_request_id TEXT;

CREATE INDEX IF NOT EXISTS
idx_clinical_form_requests_business
ON clinical_form_requests (
    business_id,
    created_at
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_requests_customer
ON clinical_form_requests (
    business_id,
    customer_id,
    created_at
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_requests_appointment
ON clinical_form_requests (
    business_id,
    appointment_id,
    created_at
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_requests_token
ON clinical_form_requests (
    request_token
);

CREATE INDEX IF NOT EXISTS
idx_clinical_form_submissions_request
ON clinical_form_submissions (
    form_request_id
);

INSERT OR IGNORE INTO schema_migrations (
    version
)
VALUES (
    '017_form_requests'
);
