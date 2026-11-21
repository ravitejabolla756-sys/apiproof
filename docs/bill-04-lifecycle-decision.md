# BILL-04 subscription lifecycle decision

## Locally enabled

The integration branch now applies only documented provider-neutral transitions: subscription creation/update, successful payment renewal, failed payment to `past_due`, and subscription deletion to `canceled`/`free`. Unknown events, refunds, grace/action-required states and invalid statuses are ignored explicitly. Older period-end updates are ignored when the current subscription period is known. Existing provider/payload idempotency remains in the billing event ledger.

## Explicit limitations

The current schema has no authoritative provider event timestamp, last-event cursor or lifecycle transition ledger. Therefore this is not proof of complete out-of-order handling or PostgreSQL concurrency safety. Refund, grace, chargeback and provider-specific retry semantics remain unavailable. Payment activation remains disabled.

## Required evidence before acceptance

- Approved provider event-to-state mapping, including refund, grace, trial, dispute and cancellation semantics.
- Sandbox sequence: create, activate, renew, failed payment, recovery, cancel, duplicate and stale delivery.
- PostgreSQL transaction/advisory-lock and concurrent-delivery tests.
- Ledger migration and unique-identity evidence from an approved isolated database.
- Owner approval for plan downgrade, cancellation timing, entitlement revocation and grace-period policy.
