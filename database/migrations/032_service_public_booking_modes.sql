-- Eselram
-- Migration: 032_service_public_booking_modes.sql

ALTER TABLE services
ADD COLUMN booking_group TEXT;

ALTER TABLE services
ADD COLUMN post_consultation_booking TEXT NOT NULL DEFAULT 'client_can_book'
CHECK (post_consultation_booking IN ('client_can_book','practitioner_managed'));

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('032_service_public_booking_modes');
