# BILL-02 provider decision package

## Current integration behavior

The branch has a typed `BillingProvider` boundary and a test-only `MockBillingProvider`. Paid checkout remains blocked by the Free Beta gate. The billing portal now returns `BILLING_PORTAL_CONTRACT_PENDING` without creating a provider session. Subscription and invoice reads require the server-derived workspace and `billing:manage`; client-supplied workspace or role claims are not trusted.

## Provider compatibility matrix

| Decision area | Dodo Payments | Cashfree | Current status |
|---|---|---|---|
| Checkout/session API | Requires owner-reviewed API and return-url contract | Requires owner-reviewed API and return-url contract | Not selected |
| Subscription lifecycle | Must map provider events to workspace subscription states | Must map provider events to workspace subscription states | Not verified |
| Invoice history | Must provide a server-fetchable, workspace-bound invoice projection | Must provide a server-fetchable, workspace-bound invoice projection | Unavailable in beta |
| Webhook authentication | Signature scheme and replay/idempotency rules require approval | Signature scheme and replay/idempotency rules require approval | Mock HMAC only |
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

No payment provider was activated and no credentials were added.
