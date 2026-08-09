# Stripe Checkout + webhook

Eselram creates Stripe Checkout Sessions server-side using the Stripe account connected by the business.

The booking remains in Eselram and a provider-independent `payments` row tracks the financial record.

## Confirmation model

The browser redirect is not the source of truth.

Payment can be confirmed by:

1. a verified Stripe webhook, or
2. a server-side retrieval of the Checkout Session after the customer returns.

The webhook endpoint is business-scoped using the business id in its URL and the webhook signing secret encrypted for that business.

## Events

Configure the Stripe endpoint for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

## Payment amount

- `online_deposit`: charges the unpaid deposit first.
- otherwise: charges the outstanding appointment amount.
- fully paid and free appointments cannot create another Checkout Session.
