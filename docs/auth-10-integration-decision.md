# AUTH-10 integration decision

## Local implementation

The integration branch now contains a schema-independent server policy boundary
in `apps/web/src/lib/server/verified-user-policy.ts`. It keeps onboarding and
recovery available, requires server-derived verification for protected workspace
and provider-link actions, and fails closed when the verification state is not
available. It never trusts a client-supplied verification flag.

The policy is covered by disposable local unit tests, including malformed state,
unverified users, provider-verified users, and unavailable verification state.

## Deliberately not activated

No existing route was changed to require verification. The active integration
schema does not contain `users.email_verified_at`, and migration 024 is not
registered because its identity conflicts with Member 2's organization
invitation/audit migration. Enabling route gates before that reconciliation would
either fail at runtime or lock out onboarding and recovery incorrectly.

## Required evidence before route activation

- Owner-approved action matrix for unverified users.
- Reconciled migration identity and isolated PostgreSQL schema evidence.
- PostgreSQL concurrency tests for verification and account-linking races.
- Hosted Google/GitHub OAuth acceptance using approved credentials.
- Browser verification of login, onboarding, recovery, and protected actions.
