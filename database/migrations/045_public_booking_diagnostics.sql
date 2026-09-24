-- Temporary QA diagnostic table for public booking startup troubleshooting.
-- Contains no customer names, email addresses, phone numbers, booking details or clinical data.
CREATE TABLE IF NOT EXISTS public_booking_diagnostics (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  stage TEXT NOT NULL,
  detail TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_public_booking_diagnostics_created
  ON public_booking_diagnostics (created_at);
CREATE INDEX IF NOT EXISTS idx_public_booking_diagnostics_business_created
  ON public_booking_diagnostics (business_id, created_at);
INSERT OR IGNORE INTO schema_migrations (version) VALUES ('045_public_booking_diagnostics');
