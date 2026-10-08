# Provider Intelligence Human Review Batch 6

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`

This is the final proposed-review packet for the remaining expansion records.
No review action was executed. Every candidate remains `needs_review` and the
production registry remains unchanged.

## Discord

Candidate: `discord-social-sdk-default-scopes-removal-2025-03-26`
Source: <https://discord.com/developers/docs/social-sdk/release_notes.html>
Facts: Social SDK 1.0 removed the deprecated `Client::GetDefaultScopes`; Discord documents `Client::GetDefaultPresenceScopes` and `Client::GetDefaultCommunicationScopes` as the separated replacements. Scope provider + operation; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Discord's official Social SDK 1.0 release notes for removal of Client::GetDefaultScopes on 2025-03-26 and the two documented replacement operations. I approve provider + operation applicability only. I do not assert an SDK package/version, endpoint, or dynamic operation mapping.","sourceFingerprint":"c99e0ddafa9cc77626fb9e83e489d03b32241b93ac8835dde1d95f27c9777fe0","evidenceFingerprint":"8557f8370b1bbf4de36852b6d058ad86703e4bb8fed699199691f1b35c2d35e7","candidateFingerprint":"1e906bd648e9263744f9c467a6dec454e74e634ecb8de8df684ec3d94f8aa24f"}
```

## Atlassian

Candidate: `atlassian-admin-v1-users-groups-api-removal-2027-06-30`
Source: <https://developer.atlassian.com/cloud/admin/changelog/>
Facts: the listed V1 Users and Groups REST APIs stop working after 2027-06-30; the V2 search APIs are documented replacements. Scope provider + resource; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Atlassian's official Cloud Admin changelog for removal of the documented V1 Users and Groups REST APIs after 2027-06-30 and the V2 replacement APIs. I approve provider + resource applicability only. I do not assert SDK package/version, undocumented endpoints, or unrelated Admin APIs.","sourceFingerprint":"abe3f469b1927f7849dd6fc24741f08f235f056e5ddfd864b66006537b9deea4","evidenceFingerprint":"21d1c6144ea1e6df1e0bbc65b9b9194c415706b23d1e1ec71f0b1a23fa1f7367","candidateFingerprint":"658084d33ee5e953d7b4e7603ab37ed4b44daf9f16db1c4cac86e906b7c7e122"}
```

## Auth0

Candidate: `auth0-enabled-clients-field-deprecation-2026-07-13`
Source: <https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations>
Facts: `enabled_clients` is deprecated on the three documented Management API connection operations and reaches end of life 2026-07-13; dedicated enabled-client endpoints are the replacement. Scope provider + endpoint + response_field; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Auth0's official deprecation page for enabled_clients on GET /api/v2/connections, GET /api/v2/connections/{id}, and PATCH /api/v2/connections/{id}, with end of life 2026-07-13 and dedicated enabled-client endpoints as replacements. I approve provider + endpoint + response_field applicability only. I do not assert SDK package/version or broader connection behavior.","sourceFingerprint":"3835836ae02c82d5e414d17ad86855f943f836aef5c1f16ef75256bfe4c9b1e3","evidenceFingerprint":"b9e362a3528ba09b390ca0c069fc8631a8ec1538e4e82380cd319d544d44073a","candidateFingerprint":"72312e7a49bf2998fbc9be8057fbb0909c0165dd30a4013962ecfc8b907d0e9a"}
```

## Linear

Candidate: `linear-mcp-sse-endpoint-removal-2026`
Source: <https://linear.app/changelog/page/3>
Facts: Linear is fully removing MCP SSE support and directs clients from `https://mcp.linear.app/sse` to `https://mcp.linear.app/mcp`. Scope provider + endpoint; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Linear's official changelog for removal of the MCP SSE endpoint and the documented /mcp replacement. I approve provider + endpoint applicability only. I do not assert SDK package/version, an unproven removal date, or unrelated Linear endpoints.","sourceFingerprint":"886d0d2caf0dc3469186e040d813a2ea6ea793eacce60f066d1a26a7b8ae1eb6","evidenceFingerprint":"0685ad84ee65b9f1c2ec70f946839f740f0aade5d7f250fca1d8ad4b7da8b1a7","candidateFingerprint":"b63e34f1dc701fa6be4668ed9d591b9fd5122b0e64fffd837d15929a7601d714"}
```

## Cohere

Candidate: `cohere-embed-v2-model-retirement-2026-04-04`
Source: <https://docs.cohere.com/docs/deprecations>
Facts: the listed Embed v2 and Aya models were retired effective 2026-04-04; current embedding and chat alternatives are documented. Scope provider + model; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Cohere's official deprecations page for retirement of the listed Embed v2 and Aya models effective 2026-04-04 and the documented replacement direction. I approve provider + model applicability only. I do not assert SDK package/version, method, endpoint, or alias behavior.","sourceFingerprint":"43cac8d4df00142fd69842679706f835789439aaec2bc7d00115a98fc09a5877","evidenceFingerprint":"307f225989e36937040e378e454306dac754126c81db8b3ccba4f82ee2db63d8","candidateFingerprint":"5e647d95af5509c02cb6715a5376495e71c38760d5521cae5a33699b99f4d529"}
```

## Mistral

Candidate: `mistral-ocr-4-0-model-retirement-2026-09-30`
Source: <https://docs.mistral.ai/resources/changelogs>
Facts: Mistral OCR 4.0 retirement on 2026-09-30 and OCR 4.1/latest replacement direction are documented. Scope provider + model; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Mistral's official changelog for retirement of mistral-ocr-4-0 on 2026-09-30 and the OCR 4.1/latest replacement direction. I approve provider + model applicability only. I do not assert SDK package/version, method, endpoint, or alias behavior beyond the source facts.","sourceFingerprint":"e913988cd4626651abe4b7b7ae63018966bfa07107f3a0c3bbe79bd0766b12a4","evidenceFingerprint":"be3a050bbba99d77cc988004eedecb0be726551d599e2efe7502e56de3d9664a","candidateFingerprint":"89e56946a30c5d544857769b5dd30b66825379312157db31bc64b4d7a57d2c56"}
```

## Neon

Candidate: `neon-api-reference-site-retirement`
Source: <https://api-docs.neon.tech/reference/getting-started-with-neon-api>
Facts: the hosted API reference site is deprecated and will be retired; the API itself is explicitly fully supported and unchanged. Scope provider + resource; severity medium.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Neon's official API reference notice that the hosted reference site is deprecated and moving to the main documentation site, while the Neon API remains fully supported and unchanged. I approve provider + resource applicability only for the hosted reference resource. I do not assert an API retirement, SDK package/version, endpoint, or method impact.","sourceFingerprint":"a59bf4fd028a18f70e93a7513cba4b747236a46ecce59a0f2d7eb0227684e1fd","evidenceFingerprint":"418959ebd253a2a60e2c4b57cbc0e286aeb641e8da8748643b244fc5828d5671","candidateFingerprint":"efe8424bd62824bb72e9a64de30ca009b01826da589546c91741ae02049d3107"}
```

## Elastic

Candidate: `elasticsearch-monitoring-plugin-removal-10`
Source: <https://www.elastic.co/docs/release-notes/elasticsearch/deprecations>
Facts: the Monitoring plugin functionality is deprecated and will be removed in 10.0. Scope provider + resource; severity high.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Elastic's official deprecations documentation for removal of the Monitoring plugin functionality in 10.0. I approve provider + resource applicability only. I do not assert SDK package/version, endpoint, or unrelated Elasticsearch monitoring behavior.","sourceFingerprint":"d692c2226a46a38a3e5f23e15f4819cf7f140750bdfaff833fa1a6609e50323e","evidenceFingerprint":"1a2319eebef639e2fbede08114bff661d9114b631f65fe37ad6dce75e3202113","candidateFingerprint":"6bb301904c2a999ebba1a778fce9921a10c4ab6a84392bbb40f73468873a7343"}
```

## Algolia

Candidate: `algolia-update-task-v1-deprecation`
Source: <https://www.algolia.com/doc/rest-api/ingestion/update-task-v1>
Facts: the Update a task V1 endpoint is marked deprecated; no removal date or replacement is asserted by the candidate. Scope provider + endpoint; severity medium.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Algolia's official API reference marks Update a task V1 deprecated. I approve provider + endpoint applicability only for that endpoint. I do not assert a removal date, replacement, SDK package/version, or broader ingestion API scope.","sourceFingerprint":"e07cbfc5ea3482885aea78b46a648aa314de223276d17ca303882d16c374c80d","evidenceFingerprint":"c6ef72958471acf61486ce8097bd53444ae9507e82613d30a705d8ba42279f84","candidateFingerprint":"30fb4842c7843fa60038f4ef52ff1a541dfb03c76ea4beb5ed9e1f6a341a5b6c"}
```

## Deepgram — not ready

Candidate: `deepgram-legacy-intelligence-parameters-2025-11-05` remains
`NEEDS_MORE_SOURCE_REVIEW`. The official source proves the legacy parameters
and HTTP 400 behavior, but does not prove a bounded operation, endpoint,
resource, model, or domain target. The strict promotion gate rejects it with
`APPLICABILITY_SCOPE_TARGET_REQUIRED`; no review input should be submitted.

All other records in this packet are `READY_FOR_HUMAN_APPROVAL` within their
stated scopes. No approval or production insertion was performed.
