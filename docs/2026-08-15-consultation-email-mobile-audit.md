# Consultation email / mobile audit

Changes made:
- Standalone consultation buttons now explicitly submit `booking_intent=consultation`.
- Consultation form automation recognises either `appointments.booking_kind=consultation` or `services.service_type=consultation`.
- Stripe post-payment automations are isolated so receipt, booking confirmation, booking-confirmed forms, and payment-received forms cannot block one another.
- Non-payment/fully-credited public booking confirmations use the same isolated automation pattern.
- Transactional email logos no longer depend on CID/data-URL attachments; a public binary logo endpoint is used instead.
- Added final global mobile containment rules to prevent viewport overflow, over-wide dialogs and spilled form controls.

No pricing, consultation-credit, package, treatment, aftercare or booking eligibility rules were changed.
