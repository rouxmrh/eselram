-- Eselram
-- Migration: 005_service_payments.sql
-- Purpose: Provider-independent payment rules for services

ALTER TABLE services
ADD COLUMN payment_timing TEXT NOT NULL DEFAULT 'pay_at_appointment'
CHECK (
  payment_timing IN (
    'online_full',
    'online_deposit',
    'pay_at_appointment',
    'free'
  )
);

UPDATE services
SET payment_timing =
  CASE payment_mode
    WHEN 'stripe_full' THEN 'online_full'
    WHEN 'stripe_deposit' THEN 'online_deposit'
    WHEN 'free' THEN 'free'
    ELSE 'pay_at_appointment'
  END;


CREATE TABLE IF NOT EXISTS service_payment_providers (
  service_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,

  PRIMARY KEY (
    service_id,
    provider_key
  ),

  FOREIGN KEY (service_id)
    REFERENCES services(id)
    ON DELETE CASCADE,

  FOREIGN KEY (provider_key)
    REFERENCES payment_providers(provider_key)
    ON DELETE RESTRICT
);


CREATE INDEX IF NOT EXISTS idx_service_payment_providers_service
ON service_payment_providers (
  service_id
);


INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('005_service_payments');
