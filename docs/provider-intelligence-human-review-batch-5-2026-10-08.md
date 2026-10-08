# Provider Intelligence Human Review Batch 5

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`

These are proposed inputs only. All five candidates remain `needs_review`, are
absent from the production registry, and passed the non-persisted generic
promotion gate. No human decision was executed.

## Vercel

Candidate: `vercel-legacy-integration-webhook-endpoints-removal-2021-08-20`
Source: <https://vercel.com/changelog/sunsetting-ui-hooks-and-legacy-webhooks>
Facts: Vercel removed the documented UI Hooks and legacy integration webhook endpoints on 2021-08-20. Scope is provider + endpoint; severity high. Unknowns are SDK/package/version scope.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Vercel's official changelog for removal of the documented UI Hooks and legacy integration webhook endpoints on 2021-08-20. I approve provider + endpoint applicability only for the listed endpoints. I do not assert SDK package, SDK version, SDK method, or unrelated Vercel integration behavior.","sourceFingerprint":"1311464e47144d9460deffb84a1020e6753516218dc42f92dc7c86c613852633","evidenceFingerprint":"343c13eb5e1f4f9bc5ee170a6870ac6822274afeb3b6b19a0b613f5e4335fc5f","candidateFingerprint":"5881ee8382c94f4b463b7ad30051efd82a843143235d65080aaed3c47a9ea588"}
```

## Datadog

Candidate: `datadog-api-catalog-update-endpoint-deprecated`
Source: <https://docs.datadoghq.com/api/latest/api-management/update-an-api/>
Facts: the API Catalog OpenAPI update endpoint `PUT /api/v2/apicatalog/api/{id}/openapi` is marked deprecated; no removal date is stated. Scope is provider + endpoint; severity medium. Unknowns are replacement timing and SDK scope.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Datadog's official API reference marks PUT /api/v2/apicatalog/api/{id}/openapi deprecated. I approve provider + endpoint applicability only for that endpoint. No removal date is asserted, and I do not assert an SDK package, SDK version, SDK method, or replacement timing.","sourceFingerprint":"68030db4b6e92b160aa7376c18168e85bf6b22bd3969cc4a89702eb0a375b895","evidenceFingerprint":"0d1a9534fc7b5bdb6b67158d7dd637580166fb92b58fc72644100776a3503f98","candidateFingerprint":"4456343b9d4a66396d5e1af7ed85f319cc67c5717deb62c0e9e3576fb3b4bedb"}
```

## New Relic

Candidate: `new-relic-rest-api-v1-superseded-by-v2`
Source: <https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-versions/>
Facts: REST API v1 is superseded by v2, with v2 documented as the replacement. Scope is provider + API version; severity medium. No package/version or endpoint scope is asserted.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified New Relic's official API version documentation that REST API v1 is superseded by v2. I approve provider + api_version applicability only for v1. I do not assert an SDK package, SDK version, SDK method, endpoint, or token-derived version.","sourceFingerprint":"0740d67d263179d32eab28f24f7c53e51e35e92aad05789da3675384e1b242fe","evidenceFingerprint":"260f501ce381743042f71ff69c72bd6e43ab8ea53deb6130537a9e6a76fdd870","candidateFingerprint":"8847dddda331d2e7423ad4440c506c970226bfe3e0e8d6329802cd17a180f99c"}
```

## Cloudflare Workers KV

Candidate: `cloudflare-workers-kv-legacy-routes-2026-10-15`
Source: <https://developers.cloudflare.com/changelog/post/2026-07-15-kv-legacy-namespace-routes-deprecation/>
Facts: the documented legacy Workers KV namespace routes are deprecated with removal on 2026-10-15; the source identifies the replacement route family. Scope is provider + endpoint; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Cloudflare's official changelog for deprecation and removal of the documented Workers KV legacy namespace routes on 2026-10-15 and the stated replacement route family. I approve provider + endpoint applicability only. I do not assert SDK package, SDK version, SDK method, or broader Cloudflare route scope.","sourceFingerprint":"01e0a1778217b537b6432ec736b800c8d237b8bbc763e8f7f55c878e716a2627","evidenceFingerprint":"e4a63108042cd68926067e16e250aa310624381b1a605e6225c8e33961b9aa0e","candidateFingerprint":"373d796c4887ecaa579c7bc31a0b6165b612798b7f211c9667158a65dae2c482"}
```

## Microsoft Azure API Management

Candidate: `microsoft-azure-api-version-retirement-pre-2021-08-01-2024-06-01`
Source: <https://learn.microsoft.com/en-us/azure/api-management/breaking-changes/api-version-retirement-sep-2023>
Facts: Azure API Management retired API versions before 2021-08-01 from 2024-06-01, with 2021-08-01 or later documented as the replacement range. Scope is provider + API version; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Microsoft's official Azure API Management breaking-change notice for retirement of API versions before 2021-08-01 effective 2024-06-01, with 2021-08-01 or later as the documented replacement range. I approve provider + api_version applicability only. I do not assert SDK package, SDK version, SDK method, endpoint, or token-derived version.","sourceFingerprint":"85d5856d6532f44067704f60631012041b6548c47f3a048dfeee25cce9cc0a86","evidenceFingerprint":"ef1d24b7dcefc7623ee62753dc82ad91b721876315cde5337548efde15eef95a","candidateFingerprint":"a8865b3315cf0e6e28710d4906490e64f385f9eb4d68a86735d9d0ef4bd73d8a"}
```

All five are `READY_FOR_HUMAN_APPROVAL` within their stated scopes. These
inputs must be submitted through the strict workflow only after Ravi confirms
the source facts.
