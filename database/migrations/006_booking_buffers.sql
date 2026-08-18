ALTER TABLE businesses
ADD COLUMN booking_buffer_before_minutes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE businesses
ADD COLUMN booking_buffer_after_minutes INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('006_booking_buffers');
