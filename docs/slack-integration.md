# MY OWL Slack integration (Phase 1)

Slack is a workspace-scoped notification and control surface. It does not perform
GitHub writes. The **Create Draft PR** interaction is authenticated against the
stored Slack installation and current MY OWL workspace membership, then enters
the existing durable migration-verification proposal queue. Only the production
verification worker may run Docker verification and create the isolated Draft PR.

## Slack app setup

Configure OAuth redirect URL as `https://<canonical-my-owl-host>/api/slack/callback`
and the Interactivity Request URL as
`https://<canonical-my-owl-host>/api/slack/interactions`. Request bot scopes
`chat:write` (message delivery) and `im:write` (open the installer's DM). Do not
request `identity.basic` or any user OAuth scopes in this bot installation flow.
The authoritative installer identity is `authed_user.id` in `oauth.v2.access`.
Only top-level bot access/refresh/expiry fields are encrypted and persisted;
user token fields are never substituted for bot credentials. The bot sends finding
alerts by direct message to the Slack user who connected the MY OWL workspace.

## Database

Apply the normal application migration before enabling the feature:

```sh
pnpm db:migrate
```

Migration `013` creates tenant-bound Slack connections, one-use OAuth state,
idempotent notification deliveries, expiring action capabilities, per-user
dismissals, and leased interaction jobs. Migration `014` adds scheduled retries,
connection-level rate-limit cooldowns, send-intent tracking, and reconciliation
indexes. Apply both migrations before deploying the web app or worker. SQLite creates the same Phase 1 schema
for local development/tests. Do not manually edit production rows.

## Environment configuration

All values are server-side only. Do not add a `NEXT_PUBLIC_` prefix.

| Variable | Web app | Verification worker | Purpose |
| --- | --- | --- | --- |
| `SLACK_CLIENT_ID` | Required for connect/callback | Required only for expiring-token refresh | Slack OAuth app identifier |
| `SLACK_CLIENT_SECRET` | Required for OAuth code exchange | Required only for expiring-token refresh | Server-side Slack OAuth secret |
| `SLACK_SIGNING_SECRET` | Required for signed interaction endpoint | Not required | Verify raw-body Slack signatures |
| `SLACK_TOKEN_ENCRYPTION_KEY` | Required to connect/read credentials | Required to deliver notifications | Base64 for exactly 32 random bytes; keep the same key on both hosts |
| `APIPROOF_APP_URL` | Required for OAuth redirect construction | Required to render finding links | Canonical HTTPS MY OWL origin in production |
| `APIPROOF_SECRET` | Existing app requirement | Existing worker requirement | Existing verifier/action-signing key; no new key role is introduced |

The Slack bot access/refresh token is AES-256-GCM encrypted in the database.
Plaintext tokens are not returned to browsers, placed in jobs/activity, or logged.
The signing secret is used by the web endpoint only. The worker needs the same
token-encryption key because it is the notification-delivery process.

## Delivery and safety behavior

Newly inserted actionable findings enqueue a workspace-bound outbox record in the
same transaction as scan persistence. Duplicate scans do not generate duplicate
alerts. The worker leases and retries Slack deliveries independently; provider
failures do not turn an otherwise completed scan into a failure. Dismissal is
scoped to the connecting MY OWL user and that notification, not global finding
state.

Slack signatures use Slack's timestamped raw-body HMAC, with a five-minute
acceptance window. Action buttons contain signed, expiring values whose hashes
are stored server-side and consumed once. Slack workspace/user identifiers are
checked against the stored connection; current MY OWL membership and finding,
repository, and workspace relationships are revalidated server-side.

Notification dispatch also verifies that the connecting MY OWL user still exists,
is a current workspace member, and retains repository/finding access before
opening a DM and immediately before posting. Revoked access is suppressed as a
terminal unauthorized delivery; private content is never sent to that recipient.

## Terminal outcomes, retries, and delivery uncertainty

Persisted terminal verification/interaction jobs are the durable outcome records.
The existing worker reconciles up to 25 missing outcome deliveries per iteration
into the same idempotent outbox. A crash or DB failure after proposal completion
does not require replaying verification or creating another PR: the terminal row
remains authoritative and recovery can enqueue later. Slack availability never
changes a successful proposal into a failure. There is no second queue service.

Before success wording is sent, the worker resolves the persisted Draft PR, checks
its workspace/repository/finding/migration, canonical isolated branch and default
base, completed scan/baseline, and the existing signed execution-proof contract.
Missing/mismatched evidence or PR records stay in scheduled reconciliation and
eventually become a terminal `SLACK_PROPOSAL_RECONCILIATION_REQUIRED` delivery
requiring investigation; a job's arbitrary result JSON/URL is never success proof.
Superseded failed-attempt messages are not sent after a PR exists.

Transient pre-send/network failures retry with a persisted next-attempt time:
30 seconds, doubling per attempt, capped at 15 minutes (five delivery attempts;
three interaction attempts). Slack `Retry-After` is a minimum delay, including
a conservative connection-wide cooldown. Permanent authorization/configuration
errors stop immediately. Jobs cannot be claimed before they are due. Expired
pre-send leases also wait before retrying; claims use the existing SQLite lock
or PostgreSQL `FOR UPDATE SKIP LOCKED` and check the update result.

External exactly-once delivery is **not claimed**. The deterministic
`client_msg_id` and unique outbox key aid deduplication but do not prove Slack
accepted a timed-out request exactly once. A send intent is persisted before
`chat.postMessage`. Lost/ambiguous acknowledgement, post-success DB failure, or
an expired lease with a send intent becomes `SLACK_DELIVERY_UNCERTAIN`, with no
blind automatic resend. Investigate the persisted channel/message metadata and
Slack before authorizing any manual repair. No new history-reading scope is
requested, and no automatic mutation or fabricated delivered state is performed.

The interaction endpoint acknowledges Slack promptly and queues actions. It never
creates a GitHub branch or pull request itself. The existing verification job,
Docker sandbox, evidence checks, and Draft-only GitHub transport remain required.
An unavailable worker results in an explicit unavailable response and no PR.
