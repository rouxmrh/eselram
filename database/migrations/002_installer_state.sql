CREATE TABLE IF NOT EXISTS installer_state (
    id INTEGER PRIMARY KEY
        CHECK (id = 1),

    current_step TEXT NOT NULL DEFAULT 'welcome',

    is_complete INTEGER NOT NULL DEFAULT 0
        CHECK (is_complete IN (0, 1)),

    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    completed_at TEXT,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO installer_state (
    id,
    current_step,
    is_complete
)
VALUES (
    1,
    'welcome',
    0
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('002_installer_state');
