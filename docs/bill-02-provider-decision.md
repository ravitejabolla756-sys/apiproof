# BILL-02 provider decision package

## Current integration behavior

The branch has a typed `BillingProvider` boundary, a test-only `MockBillingProvider`, and a Dodo adapter that is opt-in for non-production Test Mode only. Paid checkout remains blocked unless `DODO_ENABLE_TEST_CHECKOUT=true`, `DODO_PAYMENTS_ENVIRONMENT=test_mode`, a test API key, and both server-owned product IDs are configured. The billing portal remains unavailable without an approved portal contract. Subscription and invoice reads require the server-derived workspace and `billing:manage`; client-supplied workspace or role claims are not trusted.

## Provider compatibility matrix

| Decision area | Dodo Payments | Cashfree | Current status |
|---|---|---|---|
| Checkout/session API | Hosted Checkout Sessions implemented behind non-production Test Mode gate | Requires owner-reviewed API and return-url contract | Dodo test adapter prepared; live selection pending |
| Subscription lifecycle | Must map provider events to workspace subscription states | Must map provider events to workspace subscription states | Not verified |
| Invoice history | Must provide a server-fetchable, workspace-bound invoice projection | Must provide a server-fetchable, workspace-bound invoice projection | Unavailable in beta |
| Webhook authentication | Standard Webhooks raw-body verification implemented; lifecycle policy still pending | Signature scheme and replay/idempotency rules require approval | Dodo adapter local-only; hosted sandbox pending |
| Refund/grace behavior | Owner/legal decision required | Owner/legal decision required | Pending |
| Sandbox credentials | Required for hosted acceptance | Required for hosted acceptance | Not supplied |

This is a compatibility checklist, not a provider recommendation. No external documentation or provider API was contacted during this task.

## Owner decisions required

- Select exactly one provider and approve merchant onboarding.
- Confirm supported countries, tax treatment, currency and settlement regions.
- Map application plans to provider products/prices.
- Define refund, cancellation, grace, past-due and chargeback behavior.
- Approve webhook signature, replay, idempotency and retry policy.
- Supply sandbox credentials and an isolated acceptance environment.
- Approve invoice data retention and customer-support access boundaries.

No credentials were added and no live payment provider was activated. The Dodo adapter remains disabled until the owner supplies test-mode values through a secure local/deployment environment.
