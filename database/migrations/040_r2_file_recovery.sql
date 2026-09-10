-- Eselram
-- Migration: 040_r2_file_recovery.sql
-- Tracks protected R2 recovery copies created before live files are deleted.

CREATE TABLE IF NOT EXISTS eselram_file_recovery_objects (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    original_key TEXT NOT NULL,
    recovery_key TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    source_id TEXT,
    original_name TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    reason TEXT NOT NULL DEFAULT 'delete',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','restored','expired','failed')),
    protected_until TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_eselram_file_recovery_business_created
ON eselram_file_recovery_objects (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eselram_file_recovery_status
ON eselram_file_recovery_objects (status, created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('040_r2_file_recovery');
