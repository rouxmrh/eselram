-- Eselram
-- Migration: 044_booking_analytics.sql
-- Purpose: First-party booking analytics and marketing attribution.

CREATE TABLE IF NOT EXISTS analytics_sessions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    session_token TEXT NOT NULL,
    first_source TEXT,
    first_medium TEXT,
    first_campaign TEXT,
    first_content TEXT,
    landing_page TEXT,
    referrer TEXT,
    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE (business_id, session_token)
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_business
ON analytics_sessions (business_id, first_seen_at);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_token
ON analytics_sessions (business_id, session_token);

CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    analytics_session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    service_id TEXT,
    package_template_id TEXT,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (analytics_session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_business
ON analytics_events (business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type
ON analytics_events (business_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
ON analytics_events (analytics_session_id);

CREATE TABLE IF NOT EXISTS analytics_attribution (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    analytics_session_id TEXT,
    appointment_id TEXT,
    payment_id TEXT,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    referrer TEXT,
    attributed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (analytics_session_id) REFERENCES analytics_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_attribution_business
ON analytics_attribution (business_id, attributed_at);

CREATE INDEX IF NOT EXISTS idx_analytics_attribution_appointment
ON analytics_attribution (appointment_id);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('044_booking_analytics');
