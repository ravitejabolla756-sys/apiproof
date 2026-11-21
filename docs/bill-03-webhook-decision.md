# BILL-03 signed billing webhook decision

## Local behavior

The existing test provider verifies an HMAC-SHA256 signature over the exact raw request body, rejects missing or altered signatures, requires an explicitly configured signing secret, validates event identity/type, and records duplicate deliveries by provider and payload digest. Route errors are mapped to safe codes without returning provider exception details.

## Not provider verification

The current `MockBillingProvider` is a disposable test boundary only. No Dodo, Cashfree, Stripe or other provider algorithm is assumed. No live webhook endpoint, secret, subscription mutation or external callback was activated.

## Required provider evidence

- Approved provider and exact signature algorithm/header/canonicalization rules.
- Raw-body preservation requirements in the deployment framework.
- Secret storage and rotation procedure.
- Provider account/merchant identifier binding and event-version policy.
- Timestamp/replay-window semantics, delivery identifier and retry behavior.
- Sandbox signed-event fixtures, wrong-account fixtures and duplicate-delivery evidence.
- Approval of subscription state transitions and billing ledger schema.
