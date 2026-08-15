-- Eselram
-- Migration: 034_package_variants.sql

CREATE TABLE IF NOT EXISTS package_variants (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  package_template_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_minor INTEGER NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  deposit_minor INTEGER NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (package_template_id) REFERENCES package_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_package_variants_template
ON package_variants (business_id, package_template_id, is_active, sort_order);

ALTER TABLE package_sales ADD COLUMN package_variant_id TEXT;
ALTER TABLE customer_packages ADD COLUMN package_variant_id TEXT;

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('034_package_variants');
