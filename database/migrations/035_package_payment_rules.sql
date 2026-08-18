-- Eselram
-- Migration: 035_package_payment_rules.sql

ALTER TABLE package_templates
ADD COLUMN payment_rule TEXT NOT NULL DEFAULT 'full'
CHECK (payment_rule IN ('full','deposit','pay_later'));

ALTER TABLE package_variants
ADD COLUMN payment_rule TEXT NOT NULL DEFAULT 'full'
CHECK (payment_rule IN ('full','deposit','pay_later'));

UPDATE package_templates
SET payment_rule =
  CASE
    WHEN COALESCE(deposit_minor, 0) > 0 THEN 'deposit'
    ELSE 'full'
  END;

UPDATE package_variants
SET payment_rule =
  CASE
    WHEN COALESCE(deposit_minor, 0) > 0 THEN 'deposit'
    ELSE 'full'
  END;

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('035_package_payment_rules');
