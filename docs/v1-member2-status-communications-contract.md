# MY OWL V1 — Status communications contract proposal

Status: proposal for owner, Member 1 and operations review. This document does not connect a monitor, publish an uptime claim, create an incident, or authorize production communications.

## Truth boundary

The public status page must distinguish between an approved operational signal and the absence of one. Until an approved source is connected, it should say that no live monitor is connected and should not display “all systems operational,” uptime percentages, SLA language, incident history, or fabricated component health.

## Proposed source contract

An approved status source must provide a server-validated, bounded projection rather than being read directly from a client-controlled URL:

| Field | Requirement |
|---|---|
| `source_id` | Stable approved monitor/status-provider identity |
| `observed_at` | UTC timestamp; stale data is not current health |
| `overall` | Allowlisted `operational`, `degraded`, `partial_outage`, `major_outage` or `unknown` |
| `components` | Allowlisted component IDs and the same bounded state enum |
| `incidents` | Redacted incident ID, state, started/updated timestamps and reviewed public summary |
| `fresh_until` | Server-defined freshness deadline; after it, render `unknown` |
| `source_revision` | Provider revision or event identity for auditability |

The application must reject unknown states, stale snapshots, unapproved source IDs and summaries containing secrets, tenant identifiers, credentials, payment details or unsupported guarantees. A provider timeout must render an unavailable/unknown state, not an operational success.

## Publication and incident rules

- The service owner approves the source, component catalog, public wording and escalation owner before activation.
- Security, privacy, billing and notification incidents require the relevant owner review before exposing customer-impact details.
- Public summaries state verified impact and timestamps only; they do not promise an ETA unless an owner has approved that commitment.
- Resolved status requires source evidence that the affected component recovered, not merely a successful deployment or a cleared local queue.
- Historical incidents are published only from reviewed records with redacted scope and a stable public identifier.
- Every published state should be traceable to `source_id`, `observed_at`, `source_revision` and an approval record without exposing internal credentials or customer data.

## UI and accessibility requirements

The status page should expose the current state in a semantic status region, identify the observation time and source freshness, and keep the no-monitor fallback accessible. Loading, stale, unavailable, degraded and incident states must remain distinguishable from an empty component list and must pass the existing route axe, keyboard, mobile-width and link-integrity checks.

## Minimum acceptance evidence after approval

- source authentication and allowlist tests, including forged, stale, malformed and timeout responses;
- component-state mapping tests for every approved state and unknown fallback;
- redaction tests for incident summaries and identifiers;
- browser evidence for no-monitor, operational, stale, degraded, outage and recovery states;
- an incident drill with timestamps, escalation decision, public wording approval and rollback to the no-monitor fallback.

Until these decisions and tests exist, WEB-13 remains partial and the current no-monitor page is the only truthful public status representation.

The current frontend represents that boundary as `statusSourceAvailability` with code `STATUS_SOURCE_NOT_CONFIGURED`; it is a local unavailable projection only and must not be replaced by client-controlled monitor data.
