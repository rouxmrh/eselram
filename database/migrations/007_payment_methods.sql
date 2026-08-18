-- Eselram
-- Migration: 007_payment_methods.sql
-- Purpose: Track the customer-facing payment method separately
-- from the payment provider.

ALTER TABLE payments
ADD COLUMN payment_method TEXT;

ALTER TABLE payments
ADD COLUMN notes TEXT;


UPDATE payments
SET payment_method =
  CASE
    WHEN provider = 'paypal'
      THEN 'paypal'
    ELSE provider
  END
WHERE payment_method IS NULL;


CREATE INDEX IF NOT EXISTS idx_payments_payment_method
ON payments (
  payment_method
);


INSERT OR IGNORE INTO schema_migrations (
  version
)
VALUES (
  '007_payment_methods'
);
