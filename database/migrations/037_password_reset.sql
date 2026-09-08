-- Eselram
-- Migration: 037_password_reset.sql
-- Purpose: Secure, expiring, one-time password reset tokens for business users.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_ip_hash TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
ON password_reset_tokens (
    user_id,
    created_at
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
ON password_reset_tokens (
    token_hash
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('037_password_reset');
