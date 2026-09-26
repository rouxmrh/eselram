-- Eselram
-- Migration: 045_analytics_campaign_links.sql
-- Purpose: Persist custom tracking campaigns created in Analytics.

CREATE TABLE IF NOT EXISTS analytics_campaign_links (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    source TEXT NOT NULL,
    medium TEXT,
    campaign TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE (business_id, source, campaign)
);

CREATE INDEX IF NOT EXISTS idx_analytics_campaign_links_business
ON analytics_campaign_links (business_id, created_at);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('045_analytics_campaign_links');
