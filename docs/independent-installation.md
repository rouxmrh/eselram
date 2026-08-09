# Eselram independent installation

Eselram is designed so that each buyer can run an independent installation using their own infrastructure and provider accounts.

## Required Cloudflare resources

The buyer should deploy Eselram in their own Cloudflare account with:

- a Cloudflare Pages project
- the Eselram D1 database
- the repository migrations applied in order
- their own domain or Pages domain
- an installation encryption secret

## Installation encryption secret

Create a Cloudflare secret named:

`ESELRAM_ENCRYPTION_KEY`

Use a long random value unique to this installation. Example generation commands:

macOS / Linux:

`openssl rand -base64 48`

Node.js:

`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

Never commit this value to GitHub.

If this secret is lost after integrations have been saved, the encrypted provider credentials cannot be recovered. The business can reconnect the integration with a new key if necessary.

## Email provider

Clinic-to-client email is NOT sent through an Eselram-owned account.

The business creates and owns its own Resend account, verifies its own sending domain, and creates a sending API key.

After installation:

1. Sign in to Eselram.
2. Open Settings → Email.
3. Enter the business's From name.
4. Enter the verified From email.
5. Paste the business's Resend API key.
6. Save.
7. Send a test email.
8. Once the test succeeds, the status changes to Connected.

The Resend API key is encrypted before it is stored in D1.

## Independence rule

No operational clinic-to-client feature should require credentials owned by the Eselram software vendor.

Each installation should use the buyer's own:

- Cloudflare account
- domain
- database/storage
- email provider
- payment-provider accounts

The Eselram product website/domain is separate from installed customer instances.
