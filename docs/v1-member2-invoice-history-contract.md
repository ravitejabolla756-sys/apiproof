# MY OWL V1 — Invoice history contract proposal

Status: proposal for owner, legal and Member 1/provider review. This document does not create an invoice table, endpoint, provider call, download URL, payment entitlement or customer-facing invoice history.

## Safety boundary

Invoice history must be a projection of provider-backed records, not a reconstruction from client redirects, subscription status, plan copy or locally generated amounts. Until an approved provider contract and invoice-retention policy exist, the application must continue to represent invoices as unavailable and must not show simulated invoice data.

## Proposed server contract

The backend should expose an authenticated, workspace-scoped read model only after the billing owner is authorized:

```text
GET /api/billing/invoices?workspaceId=<optional-explicit-context>&cursor=<opaque>

200 {
  invoices: [{
    id: string,                 // provider invoice identity, never a client-generated amount key
    number: string | null,      // provider display number, if available
    status: "draft" | "open" | "paid" | "void" | "uncollectible" | "unknown",
    currency: string | null,
    subtotalMinor: number | null,
    taxMinor: number | null,
    totalMinor: number | null,
    issuedAt: string | null,    // ISO-8601 UTC
    dueAt: string | null,
    paidAt: string | null,
    hostedUrl: string | null,   // provider URL only after server-side validation
    pdfUrl: string | null       // provider URL only after server-side validation
  }],
  nextCursor: string | null,
  source: "provider"
}
```

The actual field names and statuses must be reconciled with the selected provider before implementation. Monetary values must remain integer minor units plus an ISO currency; the UI must never calculate or infer totals from plan labels. Provider URLs must be short-lived or server-authorized according to the provider contract and must not be accepted from query parameters or persisted as arbitrary redirect targets.

## Authorization and tenancy

- Resolve the workspace from the authenticated session and membership; explicit workspace IDs are only hints and must be membership-checked server-side.
- Restrict invoice visibility to the approved billing owner/capability. A hidden billing link is not an authorization control.
- Never resolve an invoice by provider ID alone; bind it to the provider customer and workspace recorded by the authoritative billing service.
- Return a generic not-found or forbidden response for invoices belonging to another workspace; do not reveal whether the provider ID exists.
- Recheck the current workspace and billing capability when a download/deep-link action is requested.

## Normalization and retention

The backend/provider adapter should normalize provider records into a bounded, redacted projection. It should not store card numbers, bank details, tax identifiers, invoice HTML, PDF bytes or raw provider payloads in the application database. If a local cache is approved, it must store the provider invoice ID, workspace/customer binding, normalized metadata, source timestamp, sync status and retention expiry only.

Required review decisions:

- authoritative provider and environment (sandbox versus production);
- invoice retention duration and whether historical records are fetched on demand;
- supported currencies, tax fields and provider status mapping;
- URL lifetime, redirect allowlist and whether PDF/hosted links are available;
- synchronization strategy, provider pagination/cursor semantics and stale-cache behavior;
- billing-owner capability and audit event taxonomy for viewing/download attempts;
- legal invoice requirements and the approved empty/unavailable wording.

## UI states and failure semantics

After the contract exists, the settings billing surface should cover:

- loading: an announced, non-empty state without implying invoices exist;
- unavailable: a truthful provider-not-configured state with no download control;
- empty: provider is configured and authoritative query returns no invoices;
- populated: accessible table/list with date, number, status, currency/total and an explicitly named provider link;
- transient failure: retryable alert that does not fall back to an empty list;
- authorization failure: safe denial without cross-tenant details;
- stale or expired provider link: recoverable error with a fresh server-authorized fetch path.

## Minimum acceptance evidence after approval

- provider-sink fixtures for paid, open, void, missing-number, zero-tax and multi-currency records;
- billing-owner versus member and cross-workspace authorization tests, including direct endpoint and link access;
- provider pagination, duplicate, stale-cache, timeout and retry tests;
- URL allowlist/expiry tests proving arbitrary redirects and client-supplied invoice IDs are rejected;
- retention/redaction tests proving no card data, raw payload or PDF bytes enter logs or local storage;
- browser evidence for loading, unavailable, empty, populated, failure and retry states with axe checks.

Until these decisions and tests are approved, BILL-09 remains missing for implementation and no invoice history should be represented as live.
