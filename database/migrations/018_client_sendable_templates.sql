ALTER TABLE clinical_templates
ADD COLUMN is_client_sendable INTEGER NOT NULL DEFAULT 0;

UPDATE clinical_templates
SET is_client_sendable = 1
WHERE name = 'General Consultation';

INSERT OR IGNORE INTO schema_migrations (
  version
)
VALUES (
  '018_client_sendable_templates'
);
