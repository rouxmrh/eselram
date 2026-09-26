-- Eselram
-- Migration: 043_login_email_change.sql
-- Purpose: Secure, expiring, one-time verification tokens for login email changes.

CREATE TABLE IF NOT EXISTS login_email_change_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    new_email TEXT NOT NULL COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_login_email_change_tokens_user
ON login_email_change_tokens (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_login_email_change_tokens_hash
ON login_email_change_tokens (token_hash);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('043_login_email_change');
