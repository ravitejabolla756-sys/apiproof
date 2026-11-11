# BILL-10 grace and suspension policy decision

## Current behavior in the integration branch

The current plan catalog is server-owned. Free is INR 0/month with limits of one repository, three scans/month and two draft PRs/month. Pro is INR 5,000/month with five repositories, unlimited scans and twenty draft PRs. Team is INR 15,000/month with unlimited repositories and scans and one hundred draft PRs. Enterprise is custom USD pricing with explicit high finite scan and draft-PR limits.

Paid checkout remains disabled behind `BILLING_CHECKOUT_CONTRACT_PENDING`; the portal is unavailable behind its explicit contract-pending response. Unknown plan identifiers fall back to the Free definition. These are existing protections and were not changed by BILL-10.

Subscription quota checks are server-side and workspace-scoped. `active` and `trialing` subscriptions are eligible for configured quotas. `canceled` subscriptions are denied with `SUBSCRIPTION_CANCELED`; `past_due` and `unpaid` are denied with `PAYMENT_PAST_DUE`. A provider outage must not be interpreted as a cancellation or payment failure.

## Local implementation boundary

`policy.ts` provides a pure, offline policy evaluator and strict input parser. It has no production defaults and returns `policy_unavailable` for a past-due or unpaid subscription unless an explicitly approved policy is supplied. It always denies mutations for grace/suspension decisions and preserves a read-only outcome. Provider-unavailable input takes precedence and returns `provider_unavailable`, never suspension.

This boundary is intentionally not wired into live subscription entitlements. The synthetic tests demonstrate decision mechanics only; they do not approve or activate a business policy.

## Decisions requiring owner, legal, and payment approval

The owner must approve all of the following before the boundary can affect live entitlements:

- Grace duration and whether the clock starts at the first failed attempt or a provider-confirmed event.
- Suspension trigger, retry cadence, maximum retries, recovery behavior and treatment of out-of-order events.
- Notification recipients, channels, templates, localization, bounce handling and legally required notice periods.
- Billing-owner actions, workspace-owner/admin actions, refunds, chargebacks, cancellation timing and downgrade behavior.
- Whether read-only workspace access continues during grace or after suspension, and which operations remain available.
- Provider outage behavior, including how long cached subscription state may be used and when an operator review is required.

Required evidence includes the approved provider event mapping, sandbox payment/retry sequence, PostgreSQL concurrency and event-ledger evidence, and a review of applicable legal/payment notices. No live provider, payment activation, email delivery or suspension action is enabled by this change.

## Acceptance gate

BILL-10 remains `BLOCKED_EXTERNAL` until the decisions above are approved and verified with the selected provider and an isolated PostgreSQL environment. The next safe action is owner review of this document, followed by a provider-specific policy adapter and concurrency tests only after approval.
