-- Eselram
-- Migration: 004_authentication.sql
-- Purpose: Roles, permissions and secure login sessions

-- =========================================================
-- ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS roles (
    role_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system_role INTEGER NOT NULL DEFAULT 1
        CHECK (is_system_role IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO roles (
    role_key,
    display_name,
    description
)
VALUES
    (
        'owner',
        'Owner',
        'Full access to the business and all enabled modules.'
    ),
    (
        'manager',
        'Manager',
        'Administrative access without ownership controls.'
    ),
    (
        'practitioner',
        'Practitioner',
        'Manages assigned appointments and client treatment activity.'
    ),
    (
        'receptionist',
        'Receptionist',
        'Manages bookings, customers and day-to-day scheduling.'
    ),
    (
        'admin',
        'Administrator',
        'General administrative access.'
    );


-- =========================================================
-- PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS permissions (
    permission_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO permissions (
    permission_key,
    display_name
)
VALUES
    ('business.manage', 'Manage business settings'),
    ('users.manage', 'Manage users'),
    ('services.manage', 'Manage services'),
    ('bookings.view', 'View bookings'),
    ('bookings.manage', 'Manage bookings'),
    ('customers.view', 'View customers'),
    ('customers.manage', 'Manage customers'),
    ('payments.view', 'View payments'),
    ('payments.manage', 'Manage payments'),
    ('records.view', 'View clinical records'),
    ('records.manage', 'Manage clinical records');


-- =========================================================
-- ROLE PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_key TEXT NOT NULL,
    permission_key TEXT NOT NULL,

    PRIMARY KEY (
        role_key,
        permission_key
    ),

    FOREIGN KEY (role_key)
        REFERENCES roles(role_key)
        ON DELETE CASCADE,

    FOREIGN KEY (permission_key)
        REFERENCES permissions(permission_key)
        ON DELETE CASCADE
);


-- Owner receives every permission.

INSERT OR IGNORE INTO role_permissions (
    role_key,
    permission_key
)
SELECT
    'owner',
    permission_key
FROM permissions;


-- =========================================================
-- USER ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_key TEXT NOT NULL,

    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (
        user_id,
        role_key
    ),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (role_key)
        REFERENCES roles(role_key)
        ON DELETE RESTRICT
);


-- =========================================================
-- LOGIN SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    expires_at TEXT NOT NULL,

    last_seen_at TEXT,

    revoked_at TEXT,

    ip_hash TEXT,

    user_agent TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
ON user_sessions (
    user_id
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token
ON user_sessions (
    token_hash
);


-- =========================================================
-- RECORD MIGRATION
-- =========================================================

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('004_authentication');
