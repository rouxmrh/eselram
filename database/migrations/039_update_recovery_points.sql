-- Eselram
-- Migration: 039_update_recovery_points.sql
-- Records Cloudflare D1 Time Travel bookmarks captured immediately before protected updates.

CREATE TABLE IF NOT EXISTS eselram_recovery_points (
    id TEXT PRIMARY KEY,
    recovery_type TEXT NOT NULL DEFAULT 'pre_update' CHECK (recovery_type IN ('pre_update','manual','restore_undo')),
    bookmark TEXT NOT NULL,
    from_version TEXT,
    target_version TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','used','expired','failed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eselram_recovery_points_created
ON eselram_recovery_points (created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('039_update_recovery_points');
