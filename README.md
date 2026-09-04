# Eselram

Eselram is a customer-owned booking, payments, customer-management and optional clinical-records application installed and updated through the separate Eselram Provisioner.

## Customer-owned runtime

Each installation runs in the customer's own Cloudflare infrastructure and stores its own business data. The application uses:

- Cloudflare Pages
- D1 binding: `DB`
- R2 binding: `FORM_UPLOADS`
- `ESELRAM_BASE_URL`
- `ESELRAM_ENCRYPTION_KEY`
- `ESELRAM_CRON_SECRET`
- `ESELRAM_OAUTH_BROKER_URL`

The customer owns the deployed application resources and business data. Eselram protected releases are distributed by the vendor and deployed into those customer-owned resources by the Provisioner.

## Database

Database migrations are applied in filename order by the Provisioner. Setup Health verifies the required migration chain and reports whether the installed database is up to date.

## Email

Eselram supports Gmail and Resend.

- Gmail is the recommended quick setup for businesses that do not have a sending domain.
- Resend supports branded business-domain sending.
- Provider credentials are stored encrypted within the installation's own D1 database.

## Payments

Eselram supports Stripe and pay-in-person workflows. Stripe is connected per business and its credentials and webhook signing secret are stored securely for that installation.

## Reminders

`workers/eselram-reminders.js` is deployed by the Provisioner into the customer's Cloudflare account with the configured Cron Trigger.

## Protected releases and updates

Production packages are created with the protected-release builder and stored in the private release service. The Provisioner verifies the authorised release and its SHA-256 checksum before deployment.

Installed businesses can use **Settings → Updates** to check for eligible releases and start a secure update handoff to the Provisioner. Updates preserve the existing customer database, file storage, email configuration and payment configuration, and the Provisioner verifies that the expected release becomes the live production Pages deployment before reporting success.

## Release workflow

Use GitHub Actions → **Build protected Eselram release** → **Run workflow** and enter the intended release version explicitly.

Do not reuse or overwrite an already-published release version.
