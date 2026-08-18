-- Eselram
-- Migration: 025_packages_courses.sql
-- Generic prepaid / course / package tracking.

CREATE TABLE IF NOT EXISTS package_templates (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    service_id TEXT NOT NULL,

    name TEXT NOT NULL,
    description TEXT,

    sessions_total INTEGER NOT NULL
        CHECK (sessions_total > 0),

    price_minor INTEGER NOT NULL DEFAULT 0
        CHECK (price_minor >= 0),

    deposit_minor INTEGER NOT NULL DEFAULT 0
        CHECK (deposit_minor >= 0),

    validity_days INTEGER
        CHECK (
            validity_days IS NULL
            OR validity_days > 0
        ),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_package_templates_business
ON package_templates (
    business_id,
    is_active,
    name
);


CREATE TABLE IF NOT EXISTS customer_packages (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    package_template_id TEXT,
    service_id TEXT NOT NULL,

    name_snapshot TEXT NOT NULL,
    sessions_total INTEGER NOT NULL
        CHECK (sessions_total > 0),

    price_minor INTEGER NOT NULL DEFAULT 0
        CHECK (price_minor >= 0),

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'completed',
                'cancelled',
                'expired'
            )
        ),

    starts_on TEXT,
    expires_on TEXT,
    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id)
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (package_template_id)
        REFERENCES package_templates(id)
        ON DELETE SET NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_customer_packages_customer
ON customer_packages (
    business_id,
    customer_id,
    status
);


CREATE TABLE IF NOT EXISTS customer_package_appointments (
    customer_package_id TEXT NOT NULL,
    appointment_id TEXT NOT NULL,
    linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        customer_package_id,
        appointment_id
    ),

    UNIQUE (appointment_id),

    FOREIGN KEY (customer_package_id)
        REFERENCES customer_packages(id)
        ON DELETE CASCADE,

    FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS customer_package_payments (
    customer_package_id TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        customer_package_id,
        payment_id
    ),

    UNIQUE (payment_id),

    FOREIGN KEY (customer_package_id)
        REFERENCES customer_packages(id)
        ON DELETE CASCADE,

    FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE CASCADE
);


INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('025_packages_courses');
