# AUTH-05 integration decision

## Enabled locally

The integration branch now contains the provider-neutral transactional email configuration boundary and the email-verification service from Member 1. The service generates URL-safe single-use tokens, stores only SHA-256 digests, bounds expiry, invalidates prior outstanding tokens, serializes user/token state transitions in a transaction, and removes a reservation after delivery failure. Tests use disposable SQLite and an injected fake transport; no email is sent.

## Deliberately not activated

Migration `024` is not registered in the integration migrator. Member 1 uses `email_verification_tokens_and_user_state`, while Member 2 uses `workspace_invitations_and_audit_events`. The fixture migration is available only to local tests. The auth route and production signup/verification flow remain unchanged until the migration ledger and schema are reconciled.

## Required approval and evidence

- Owner decision on a forward-only compatibility strategy for migration `024`.
- Approved isolated PostgreSQL ledger and schema evidence before activation.
- Chosen email provider, verified sender/domain, sandbox credentials, templates, bounce/complaint handling and retry policy.
- PostgreSQL row-lock/concurrency and RLS/grant verification.
- Route contract for resend, verification success/replay, unavailable delivery and rate limiting.

No token, SMTP credential, personal data or live provider response is recorded by this change. Passing local fake-transport tests is not provider or production verification.
