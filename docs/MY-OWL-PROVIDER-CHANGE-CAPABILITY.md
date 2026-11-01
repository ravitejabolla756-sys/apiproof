# MY OWL provider-change capability

## What the product does

MY OWL observes connected GitHub repositories without executing repository code. It discovers provider usage, evaluates source code against reviewed compatibility rules, stores evidence-backed findings, and can create a deterministic draft pull request through the existing migration-proposal safety boundary.

The provider-change pipeline adds the missing lifecycle:

1. Every supported provider has an allowlisted official source monitored on a six-hour schedule.
2. A source fingerprint is stored with ETag/Last-Modified metadata and bounded body handling.
3. A source change creates a review candidate. It never becomes a production rule automatically.
4. When an approved rule already covers the affected provider, the six-hour changelog job immediately processes a bounded provider rescan queue; nightly freshness jobs remain separate. A newly discovered rule still waits for human review before it can affect findings.
5. An authenticated workspace owner reviews a candidate with written notes and can test its extracted identifiers against sample code without mutating the repository.
6. Approval loads the reviewed rule into subsequent productization scans and queues rescans for repositories with observed usage of that provider; repositories with no completed provider index remain eligible as an unknown-scope safety fallback.
7. When a monitored provider source changes, MY OWL re-queues completed rescans for existing approved rules and also creates a repository-level rescan for indexed repositories that have no approved dynamic candidate. That fallback runs the normal multi-provider scan against the already-reviewed static registry without inventing or auto-approving a new rule. Both paths are workspace-scoped, deduplicated, and provenance-tagged; the newly observed source remains review-only.
8. A nightly job queues repositories whose last completed scan is older than one hour.
9. Rescan jobs use durable leases, retry state, explicit `triggered_by` provenance, and the existing GitHub scan worker; repository default branches remain the only scan target.
10. The productization path dispatches the existing static adapters for TypeScript/JavaScript, Python, Go, Java, Kotlin, and C# into one normalized usage IR before reviewed-registry evaluation and compatibility-proof generation. Both queued worker scans and authenticated manual scans use this path when `PROVIDER_INTELLIGENCE_V1_ENABLED=true`; the established Stripe/Twilio adapters remain a deliberate compatibility bridge for reviewed legacy rules that have not yet been projected into the normalized registry.
11. When a changed source belongs to a provider observed in an active repository, MY OWL creates one workspace-scoped, deduplicated Slack outbox delivery. The trusted worker sends a review-only alert through the encrypted Slack connection; rate limits, retries, leases, and uncertain delivery states are persisted without activating a production rule.

The end-to-end local worker proof now covers the complete control-plane transition: an unapproved structured candidate is absent from the workspace registry; owner approval scopes it to the workspace and queues a rescan; the rescan resolves the mocked repository's exact default-branch SHA; the real scan worker evaluates the approved rule and persists an `AFFECTED` finding and completed job. A companion rollback test confirms that disabling `PROVIDER_INTELLIGENCE_V1_ENABLED` prevents the approved dynamic rule from entering the worker scan. These are deterministic local tests, not proof of a deployed Vercel cron or live GitHub transport.

The full-catalog monitor honors each source's persisted `next_attempt_at`: a source is fetched only when due, and a cron response reports attempted, skipped, changed, and failed sources separately. The provider coverage page also exposes source health (`never-run`, `healthy`, `due`, `failing`, or `disabled`) and parser state (`structured`, `review-only`, or `not-run`) independently from reviewed scanner coverage. A source that cannot be parsed into a concrete provider change is explicitly marked review-only and remains a human-review snapshot; it is not silently reported as structured support.

The internal automation contracts are covered by route-level tests: changelog refreshes require the exact `CRON_SECRET`, unknown provider identifiers are rejected before any network fetch, and the nightly rescan endpoint returns a structured zero-work result when its queue is empty. These tests prove the route boundaries locally; they do not prove that the deployed Vercel cron is enabled or has executed successfully.

The protected `/api/internal/provider-intelligence/status` route provides an operational readiness snapshot for deployment checks: runtime flag state, the deployed commit and worker version, the SHA-256 digest of the reviewed provider registry, all 19 source-health records, pending review/approval and rescan queue counts, and scan-worker metrics. It intentionally omits fetched source bodies and requires the exact cron secret. The provider-rule review API applies workspace scope to listing, sample testing, editing, approval, and rejection, allowing only unassigned global candidates and candidates assigned to the current workspace.

Migration-template coverage is reported independently from scanner coverage. The current static digest-bound executable catalog contains 15 verified templates across 12 providers, while the other launch providers are explicitly review-only until provider-specific AST semantics, fixtures, and verification evidence are added. Every current candidate also has either a bounded transformation proposal or a provider-specific manual migration playbook; behavioral migrations never become executable merely because a replacement sentence exists. An authenticated owner may attach an explicit migration template to an approved database-backed rule; the template is accepted only when its transformation schema is valid and it cites the same official source URL as the candidate, then it is rebound to the normalized reviewed-change digest before patch generation. Stale, cross-workspace, or mismatched-source templates fail closed. No replacement sentence or package identifier is promoted into an executable fix automatically.

Finding detail responses also expose the exact candidate-specific review-only playbook when the persisted provider and change ID match an official candidate. This gives operators actionable migration steps and validation checks without treating manual guidance as an executable patch.

## Provider source catalog

The catalog contains the 19 launch providers from the product brief: Stripe, Twilio, OpenAI, Firebase, GitHub, AWS, Google Cloud, Slack, SendGrid, Shopify, Auth0, Clerk, Supabase, Vercel, Cloudflare, LaunchDarkly, ElevenLabs, Groq, and Braintree.

All 19 monitored providers now have source-specific dedicated parsers: Stripe, Twilio, OpenAI, Firebase, GitHub, AWS, Google Cloud, Slack, SendGrid, Shopify, Auth0, Clerk, Supabase, Vercel, Cloudflare, LaunchDarkly, ElevenLabs, Groq, and Braintree. Every parser emits source-bound evidence and keeps candidates review-only. A source that changes without a concrete identifier remains an unstructured evidence candidate and cannot enter the production registry. This is intentional: a changelog page changing is not proof that a particular repository call is incompatible.

## Safety boundaries

- Official sources are HTTPS-only, host-allowlisted, DNS-checked against private/link-local addresses, bounded to 5 MB, and limited to two redirects.
- Fetches have a timeout and preserve ETag/Last-Modified validators.
- Candidate approval requires a typed change, applicability scope, and source facts.
- Candidate review is owner-authorized and auditable.
- Scan findings are deterministic and evidence-bound.
- Existing migration proposals remain draft PRs with no auto-merge and no default-branch write.
- Rescans are workspace-scoped and idempotent.
- Completed scans maintain a durable repository-provider usage index, so approved-rule fan-out can target observed provider usage without silently excluding repositories that have not yet produced an index.

## Current limitation before beta claims

The source-monitoring, rescan, owner review/test, dashboard visibility, and cross-language productization foundations are implemented and tested, but a beta claim should still distinguish “source observed” from “provider-specific compatibility rule verified.” The Go/JVM/.NET orchestration uses explicit static adapter evidence (verified language package bindings when present, package metadata where available, API domains, and environment variables); JavaScript package identifiers are never reused as guessed Go modules, Maven coordinates, or NuGet namespaces. It is not compiler/type-checker or runtime reachability analysis. Remaining hardening work is to expand dedicated parsers and migration templates across the remaining providers, add verified language package metadata, run live-source replay/canary tests, verify the Vercel cron plus GitHub installation path in the deployed environment, and promote the rollout flag only after those gates pass.

