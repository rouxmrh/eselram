# Eselram 022 — Independent Payments

## What 022 adds

Eselram already had a provider-independent payments ledger and payment-provider tables.

022 adds the business-owned Stripe integration layer:

- Settings → Payments is now a real Stripe configuration screen.
- The business supplies its own Stripe key.
- Stripe secrets are encrypted using that installation's `ESELRAM_ENCRYPTION_KEY`.
- The key is never returned to the browser after saving.
- Eselram tests the key against Stripe's authenticated balance endpoint.
- A successful test marks Stripe connected in `business_payment_providers`.
- Stripe becomes the default payment provider when verified.
- Setup & Health can therefore recognise the payment configuration.
- Disconnecting Stripe falls back to Pay at appointment.

## Important boundary

022 connects and verifies the business's Stripe account.

The existing Eselram Payments page continues to be the provider-independent payment ledger.

022 does NOT yet add a public Stripe Checkout/payment-intent flow or Stripe webhook endpoint. Those require the next online-payment transaction layer so that payments initiated by clients can be created and reconciled safely.

## Stripe keys

A business can use a Stripe secret key or an appropriately permissioned restricted key.

Keep Stripe server-side keys private. Never put them in frontend JavaScript or GitHub.

## Test procedure

1. Deploy 022.
2. Open Settings → Payments.
3. Paste the business's Stripe test-mode key first.
4. Save Stripe settings.
5. Click Test connection.
6. Status should become Connected and Mode should show Test.
7. Open Setup & Health and click Recheck.
8. Payments should now show Ready and the installation should reach 10/10 if all other checks are complete.
9. Inspect `business_integrations`; `encrypted_credentials` must be ciphertext rather than the plaintext Stripe key.
