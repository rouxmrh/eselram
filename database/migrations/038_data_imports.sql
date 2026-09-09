-- Eselram
-- Migration: 038_data_imports.sql
-- Auditable imports for customer, booking, package, payment, voucher and treatment-record data.

CREATE TABLE IF NOT EXISTS data_import_batches (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    created_by_user_id TEXT,
    source_filename TEXT,
    customers_imported INTEGER NOT NULL DEFAULT 0,
    bookings_imported INTEGER NOT NULL DEFAULT 0,
    packages_imported INTEGER NOT NULL DEFAULT 0,
    payments_imported INTEGER NOT NULL DEFAULT 0,
    vouchers_imported INTEGER NOT NULL DEFAULT 0,
    treatment_records_imported INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS data_import_references (
    business_id TEXT NOT NULL,
    import_batch_id TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('customer','booking','package','payment','treatment_record')),
    external_reference TEXT NOT NULL,
    internal_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (business_id, entity_type, external_reference),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (import_batch_id) REFERENCES data_import_batches(id) ON DELETE SET NULL
);

ALTER TABLE appointments ADD COLUMN import_batch_id TEXT;
ALTER TABLE appointments ADD COLUMN external_reference TEXT;
ALTER TABLE appointments ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reminders_enabled IN (0, 1));
ALTER TABLE treatment_records ADD COLUMN import_batch_id TEXT;
ALTER TABLE treatment_records ADD COLUMN external_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_data_import_batches_business ON data_import_batches (business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_data_import_refs_internal ON data_import_references (business_id, entity_type, internal_id);
CREATE INDEX IF NOT EXISTS idx_appointments_import_batch ON appointments (business_id, import_batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_external_reference ON appointments (business_id, external_reference) WHERE external_reference IS NOT NULL AND external_reference != '';
CREATE INDEX IF NOT EXISTS idx_treatment_records_import_batch ON treatment_records (business_id, import_batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_treatment_records_external_reference ON treatment_records (business_id, external_reference) WHERE external_reference IS NOT NULL AND external_reference != '';

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('038_data_imports');
