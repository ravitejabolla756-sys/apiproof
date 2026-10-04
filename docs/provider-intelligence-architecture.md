# MY OWL Provider Intelligence Architecture

This document describes the local analysis contracts currently implemented in
MY OWL. It intentionally distinguishes discovery from compatibility claims and
static language evidence from executed behavior.

## Provider registry and capability levels

Provider metadata lives under `packages/providers`. The registry is the source
of truth for package identifiers, package families, API domains,
environment-variable identifiers, and provider capability levels. The analyzer
does not contain provider-specific catalogs.

Discovery, version awareness, compatibility, migration, and verified migration
are separate capability levels. Discovering a package or URL never implies that
the provider has reviewed compatibility intelligence.

## Version resolution

The TypeScript/JavaScript analyzer prefers installed and lockfile evidence over
declared ranges. Python, Go, JVM, and .NET adapters expose declared and
lockfile/project evidence through the same dependency and normalized-IR fields.
Ranges are never reported as exact versions. When an exact version cannot be
proven, the result remains declared-only or unknown.

## Compatibility and reviewed changes

`packages/shared/src/compatibility.ts` defines the provider-neutral result and
reviewed change contracts. `packages/providers/src/compatibility-registry.ts`
compiles only reviewed records with official provenance. Candidate and
synthetic records are separate and cannot enter production compatibility
evaluation. The production registry is intentionally empty until real official
records are manually reviewed and added. The evaluator also exposes an
explicit production provenance policy; registered production evaluation enables
it so a synthetic record cannot produce `AFFECTED` even if passed directly.

The registry indexes changes by provider, package, operation, and change ID.
Compatibility decisions are `AFFECTED`, `NOT_AFFECTED`, or `NEEDS_REVIEW`.
Uncertainty does not become an affected claim.

An affected SDK version range is optional for provider API changes that apply
independently of a client-library release, such as a removed hosted endpoint.
Those records still require reviewed official provenance and static matching
usage. SDK operation and raw HTTP endpoint evidence are alternative proofs of
the same API target; parameter, model, and response-field constraints remain
additional requirements. Candidate promotion permits this version-unconstrained
case, but still requires an explicit human review before production use.

`evaluateRegisteredNormalizedCompatibility` is the provider-neutral bridge
from normalized usage IR to every reviewed change indexed for that provider.
It enables official provenance enforcement and returns no claims when the
compiled production registry has no reviewed record.

The production-safe `/api/compatibility-proof` endpoint and the dashboard
Compatibility view expose only compiled reviewed records. With no official
records currently present, they render an explicit empty state rather than
synthetic proofs or fabricated counts.

## Candidate ingestion

`packages/shared/src/change-ingestion.ts` and
`packages/providers/src/change-ingestion-registry.ts` define candidate source
fingerprints, lifecycle states, review metadata, deduplication, source update
detection, and reviewed promotion. No web scraper or LLM is a source of truth.
`fingerprintOfficialSource` hashes a canonical source URL (without its
presentation-only fragment) together with the exact fetched body, allowing
update detection without retaining source text in a candidate record.
`OfficialSourceAdapter` is a validated integration boundary, not a built-in
scraper: any future adapter must explicitly return its source type, fetch date,
URL, and exact body before candidate normalization can begin.
`OFFICIAL_CHANGE_CANDIDATE_REGISTRY` is a separate review queue. Its first
captured OpenAI candidate is `needs_review` and is deliberately absent from the
production registry and every production compatibility API.
Candidate lookup is indexed by candidate ID, source fingerprint, provider,
affected package, proposed operation, and proposed production change ID, so
reviewer tooling can retrieve the relevant queue slice without scanning every
candidate. Multiple official sources may corroborate one proposed change ID;
they remain separate candidates until a human reconciles their evidence.
Compilation rejects a candidate when its final audit-trail state differs from
its declared lifecycle state, when audit dates move backward, or when a trail
skips a lifecycle transition (`discovered → normalized → needs_review → reviewed`
or rejection at any pre-review stage).
Promotion additionally requires a reviewed audit-trail entry and a human
reviewer; agent-only review cannot enter the production registry.

### Human review checklist

Reviewers promote a candidate only after recording an attributable human review
event and checking all of the following against the retained source snapshot:

1. **Source identity:** the canonical URL belongs to the named provider and
   the captured fingerprint still matches the source body under review.
2. **Change facts:** title, type, dates, affected package/version scope, and
   removals or replacements are supported by the official source. Omit fields
   that the source does not establish rather than inferring them.
3. **Matching boundary:** every operation, endpoint, parameter, model, or
   response-field constraint is narrow enough that a static repository match
   proves the changed condition. Dynamic or wrapper-mediated behavior remains
   `NEEDS_REVIEW`.
4. **Negative boundary:** packages, methods, and similarly named provider APIs
   outside the official scope cannot match the reviewed change.
5. **Provenance and timing:** source type, URL, fingerprint, source capture
   time, reviewer identity, and review time are retained. A changed source
   fingerprint requires re-review; it is not silently treated as the previous
   reviewed evidence.

Promotion must be rejected if any check is inconclusive. The resulting
production record remains data-only: it can support compatibility proofs, but
does not authorize a migration, command execution, GitHub write, or deployment.

## Normalized usage IR

`packages/shared/src/usage-ir.ts` is the language-neutral boundary. Adapters
translate imports, SDK operations, constructors, raw HTTP endpoints, models,
parameters, response fields, environment/configuration evidence, locations,
confidence, and version evidence into this representation. Existing legacy
TypeScript findings remain available for compatibility.

## Compatibility Proof snapshots

`packages/shared/src/compatibility-proof.ts` binds evaluator results to a
repository ID, exact baseline SHA (Git commit or content digest), and scan ID. Proof identities are stable
and duplicate results are removed deterministically. Production snapshots
exclude draft or synthetic-provenance results; synthetic results are accepted
only when callers explicitly select test mode. This is the persistence/API
boundary for a future generic scan-result integration and does not alter the
legacy Stripe/Twilio worker envelope.

The authenticated compatibility-map route now parses persisted IR, evaluates
only the compiled production registry, and attaches proofs when reviewed
official records exist. With the current empty registry it emits no proof
claims, preserving the existing response shape.

Completed manual and asynchronous scan rows now also carry a bounded
`usageIR` projection alongside the legacy compatibility aggregate and generic
discovery envelope. The projection contains static identifiers, versions,
locations, and evidence metadata only; it does not persist source snippets or
argument values.

## Language adapters

`MultiLanguageRepositoryAnalyzer` provides explicit dispatch while preserving
the existing TypeScript-first `analyze` method.

- TypeScript/JavaScript: AST-backed static analysis and package lockfile support.
- Python: static requirements/pyproject/Poetry/uv evidence and Python source
  patterns.
- Go: static `go.mod`/`go.sum` evidence and import, call, URL, and environment
  patterns.
- Java/Kotlin: bounded text discovery for Maven/Gradle, imports, calls, URLs,
  and configuration.
- C#/.NET: bounded text discovery for PackageReference/PackageVersion,
  `using`, calls, URLs, and environment/configuration access.

The Python, Go, JVM, and .NET adapters do not execute code, load compiler
semantic models, resolve arbitrary dynamic imports, or infer runtime behavior.
Those boundaries are represented as limitations rather than hidden guesses.

## Incremental scanning

`packages/shared/src/incremental-graph-v2.ts` models a repository baseline,
files, normalized usages, providers, versions, operations, changes, and
compatibility results. Its planner selects impacted usage and change nodes for
changed files, dependency state, or provider state while preserving the
baseline SHA. A reusable graph index provides direct file, package, provider,
usage, and change lookups; `summarizeIncrementalLookupComplexity` reports the
indexed candidate work and a comparable naive provider-by-node estimate. The
graph is an index over analyzer output, not a second provider rule catalog.

## Migration and verification

`migration-v2.ts` contains deterministic, fail-closed migration contracts.
`verification-v2.ts` binds before/after proofs, patch and target-file digests,
repository baseline, and build/typecheck/test gate evidence. These contracts do
not apply patches, execute commands, or create GitHub pull requests.

## CI/GitHub check foundation

`github-check-v2.ts` converts validated compatibility proofs into local
`PASS`, `WARN`, `FAIL`, or `NEEDS_REVIEW` results. It is side-effect free and
records that no live GitHub write occurred. Live checks, auto-merge, and
credential expansion are outside this foundation.

## Scaling boundary

Provider discovery uses compiled package, prefix, environment, and hostname
indexes. Incremental graph planning uses direct file/package/provider-to-usage
relationships rather than rescanning every provider for every source node.
The current bounded target is approximately `O(evidence + matches)` for
provider discovery and `O(changed inputs + candidate matches)` for incremental
planning. The remaining scaling work is measuring graph/evidence storage costs
on representative repository snapshots and adding conflict diagnostics as the
reviewed change registry gains real records.
