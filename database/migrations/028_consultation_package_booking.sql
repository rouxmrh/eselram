-- Eselram
-- Migration: 028_consultation_package_booking.sql
-- Public prerequisite-aware consultation bookings and package booking visibility.

ALTER TABLE services
ADD COLUMN consultation_duration_minutes INTEGER
CHECK (
  consultation_duration_minutes IS NULL
  OR consultation_duration_minutes > 0
);

ALTER TABLE services
ADD COLUMN consultation_price_minor INTEGER NOT NULL DEFAULT 0
CHECK (consultation_price_minor >= 0);

ALTER TABLE services
ADD COLUMN consultation_payment_timing TEXT NOT NULL DEFAULT 'free'
CHECK (
  consultation_payment_timing IN (
    'online_full',
    'pay_at_appointment',
    'free'
  )
);

UPDATE services
SET
  consultation_duration_minutes =
    CASE
      WHEN requires_consultation = 1
        THEN MIN(duration_minutes, 30)
      ELSE NULL
    END,
  consultation_price_minor =
    CASE
      WHEN requires_consultation = 1
        THEN deposit_minor
      ELSE 0
    END,
  consultation_payment_timing =
    CASE
      WHEN requires_consultation = 1
           AND deposit_minor > 0
        THEN 'online_full'
      WHEN requires_consultation = 1
        THEN 'free'
      ELSE 'free'
    END;

ALTER TABLE appointments
ADD COLUMN booking_kind TEXT NOT NULL DEFAULT 'service'
CHECK (
  booking_kind IN (
    'service',
    'consultation'
  )
);

CREATE INDEX IF NOT EXISTS idx_appointments_consultation_lookup
ON appointments (
  business_id,
  customer_id,
  service_id,
  booking_kind,
  status
);

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('028_consultation_package_booking');
