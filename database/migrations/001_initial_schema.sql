-- Eselram
-- Migration: 001_initial_schema.sql
-- Purpose: Core platform schema for the first development release
-- Target: Cloudflare D1 / SQLite

PRAGMA foreign_keys = ON;

-- =========================================================
-- SCHEMA MIGRATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- BUSINESSES
-- One installation is licensed to one business, but keeping
-- business_id relationships makes the architecture portable.
-- =========================================================
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    country_code TEXT NOT NULL DEFAULT 'GB',
    timezone TEXT NOT NULL DEFAULT 'Europe/London',
    currency TEXT NOT NULL DEFAULT 'GBP',
    locale TEXT NOT NULL DEFAULT 'en-GB',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- USERS
-- Owner/admin accounts. Password hashes must be created by
-- the application; never store plain-text passwords.
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner', 'admin', 'staff')),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE (business_id, email)
);

-- =========================================================
-- BUSINESS SETTINGS
-- Flexible key/value configuration for settings that do not
-- deserve their own dedicated table.
-- =========================================================
CREATE TABLE IF NOT EXISTS business_settings (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    value_type TEXT NOT NULL DEFAULT 'string'
        CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE (business_id, setting_key)
);

-- =========================================================
-- SERVICES
-- The core never hard-codes tattoo, laser, facial, massage,
-- etc. Behaviour is configured through service attributes.
-- Monetary values are stored in minor units (pence/cents).
-- =========================================================
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL
        CHECK (duration_minutes > 0),
    price_minor INTEGER NOT NULL DEFAULT 0
        CHECK (price_minor >= 0),
    deposit_minor INTEGER NOT NULL DEFAULT 0
        CHECK (deposit_minor >= 0),
    payment_mode TEXT NOT NULL DEFAULT 'pay_at_appointment'
        CHECK (payment_mode IN (
            'stripe_full',
            'stripe_deposit',
            'pay_at_appointment',
            'free'
        )),
    requires_consultation INTEGER NOT NULL DEFAULT 0
        CHECK (requires_consultation IN (0, 1)),
    requires_patch_test INTEGER NOT NULL DEFAULT 0
        CHECK (requires_patch_test IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- =========================================================
-- WORKING HOURS
-- One row per weekday. weekday follows ISO convention:
-- 1 = Monday ... 7 = Sunday.
-- =========================================================
CREATE TABLE IF NOT EXISTS working_hours (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    weekday INTEGER NOT NULL
        CHECK (weekday BETWEEN 1 AND 7),
    is_open INTEGER NOT NULL DEFAULT 0
        CHECK (is_open IN (0, 1)),
    open_time TEXT,
    close_time TEXT,
    booking_interval_minutes INTEGER NOT NULL DEFAULT 30
        CHECK (booking_interval_minutes > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE (business_id, weekday)
);

-- =========================================================
-- CUSTOMERS
-- =========================================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT COLLATE NOCASE,
    phone TEXT,
    notes TEXT,
    marketing_consent INTEGER NOT NULL DEFAULT 0
        CHECK (marketing_consent IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- =========================================================
-- APPOINTMENTS
-- Snapshot price fields preserve the commercial terms that
-- applied when the appointment was booked.
-- =========================================================
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    assigned_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN (
            'pending',
            'confirmed',
            'completed',
            'cancelled',
            'no_show'
        )),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    price_minor INTEGER NOT NULL DEFAULT 0
        CHECK (price_minor >= 0),
    deposit_due_minor INTEGER NOT NULL DEFAULT 0
        CHECK (deposit_due_minor >= 0),
    booking_source TEXT NOT NULL DEFAULT 'online'
        CHECK (booking_source IN ('online', 'admin', 'import')),
    customer_notes TEXT,
    internal_notes TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CHECK (end_at > start_at)
);

-- =========================================================
-- PAYMENTS
-- Supports Stripe and non-online payment records.
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    appointment_id TEXT,
    customer_id TEXT,
    provider TEXT NOT NULL
        CHECK (provider IN ('stripe', 'manual', 'none')),
    payment_type TEXT NOT NULL
        CHECK (payment_type IN (
            'full',
            'deposit',
            'balance',
            'pay_at_appointment',
            'refund'
        )),
    amount_minor INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'GBP',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'paid',
            'failed',
            'refunded',
            'partially_refunded',
            'due'
        )),
    provider_reference TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- =========================================================
-- MODULES
-- Paid or optional Eselram modules are enabled here.
-- Clinical Records is intentionally not part of core tables.
-- =========================================================
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (is_enabled IN (0, 1)),
    licence_reference TEXT,
    enabled_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE (business_id, module_key)
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_users_business
    ON users (business_id);

CREATE INDEX IF NOT EXISTS idx_services_business_active
    ON services (business_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_customers_business_email
    ON customers (business_id, email);

CREATE INDEX IF NOT EXISTS idx_appointments_business_start
    ON appointments (business_id, start_at);

CREATE INDEX IF NOT EXISTS idx_appointments_customer
    ON appointments (customer_id, start_at);

CREATE INDEX IF NOT EXISTS idx_appointments_service
    ON appointments (service_id, start_at);

CREATE INDEX IF NOT EXISTS idx_payments_appointment
    ON payments (appointment_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
    ON payments (provider, provider_reference);

-- Record the migration.
INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('001_initial_schema');
