# Eselram — RC1 application

Eselram is the customer-owned booking, payments, customer-management and optional clinical-records application installed by the separate Eselram Provisioner.

## Customer-owned runtime

Each installation runs in the customer's own infrastructure and stores its own business data. The application expects:

- Cloudflare Pages
- D1 binding: `DB`
- R2 binding: `FORM_UPLOADS`
- `ESELRAM_BASE_URL`
- `ESELRAM_ENCRYPTION_KEY`
- `ESELRAM_CRON_SECRET`
- `ESELRAM_OAUTH_BROKER_URL`

## Database

Migrations `001` through `036` are applied in filename order by the Provisioner. Setup Health expects the same migration chain through `036_gmail_email_provider`.

## Email

Eselram supports Resend and Gmail. Provider credentials are encrypted inside the installation's own D1 database.

## Payments

Stripe is connected per business. The Provisioner now creates the installation's Stripe webhook endpoint and stores its signing secret encrypted in D1. Browser-return verification remains as an additional recovery path.

## Reminders

`workers/eselram-reminders.js` is the buyer-owned scheduled Worker source. The Provisioner now deploys it into the customer's Cloudflare account with a 15-minute Cron Trigger.

## RC1 boundary

The application/provisioning baseline is being frozen before the next architecture phase. Licensing, signed vendor releases and customer-approved update installation are intentionally not implemented in this RC1 codebase.
