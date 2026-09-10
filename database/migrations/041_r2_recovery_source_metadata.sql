-- Eselram
-- Migration: 041_r2_recovery_source_metadata.sql
-- Stores the application metadata required to reconnect restored R2 objects.

ALTER TABLE eselram_file_recovery_objects
ADD COLUMN source_metadata_json TEXT;

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('041_r2_recovery_source_metadata');
