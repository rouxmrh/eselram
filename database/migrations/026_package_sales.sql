-- Eselram
-- Migration: 026_package_sales.sql
-- Pending/paid package sales shared by staff and public package purchase.

ALTER TABLE package_templates
ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0
CHECK (is_public IN (0, 1));

CREATE TABLE IF NOT EXISTS package_sales (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    package_template_id TEXT NOT NULL,

    source TEXT NOT NULL DEFAULT 'staff'
        CHECK (source IN ('staff', 'public')),

    payment_choice TEXT NOT NULL DEFAULT 'full'
        CHECK (payment_choice IN ('deposit', 'full')),

    amount_minor INTEGER NOT NULL
        CHECK (amount_minor >= 0),

    currency TEXT NOT NULL DEFAULT 'GBP',

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),

    payment_id TEXT,
    provider_reference TEXT,
    customer_package_id TEXT,

    created_by_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (package_template_id) REFERENCES package_templates(id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_package_id) REFERENCES customer_packages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_package_sales_business
ON package_sales (business_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_package_sales_customer
ON package_sales (business_id, customer_id, created_at);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('026_package_sales');
