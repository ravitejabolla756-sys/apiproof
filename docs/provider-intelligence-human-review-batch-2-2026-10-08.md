# Provider Intelligence Source Revalidation Batch 2

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`
Baseline: `e19ccc1`

## Safety boundary

This packet records a provenance-only refresh. The complete official source
body for each row was re-fetched and fingerprinted using
`fingerprintOfficialSource`; the candidate-specific normalized evidence was
then compared using `fingerprintCandidateEvidence`. No candidate facts,
reviewer metadata, or production-registry records were added. Every candidate
below remains `needs_review`.

Most sources changed at the full-document level while their candidate-specific
evidence stayed unchanged; those rows classify as
`DOCUMENT_UPDATED_EVIDENCE_UNCHANGED`. The Square and Auth0 sources also
support missing target context, so their normalized evidence was completed and
they classify as `EVIDENCE_UPDATED_REVIEW_REQUIRED`. Neither classification is
an approval or promotion.

## Revalidated candidates

| Provider | Candidate | Current complete-document fingerprint | Candidate-specific status |
| --- | --- | --- | --- |
| ElevenLabs | `elevenlabs-v1-model-removal-2026-07-09` | `c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a` | v1 model removal facts unchanged |
| Cloudflare | `cloudflare-service-key-auth-removal-2026-09-30` | `d42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9` | Service Key facts unchanged |
| Clerk | `clerk-api-2026-05-12-metadata-fields-removed` | `cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a` | metadata-field facts unchanged |
| Groq | `groq-models-decommissioned-2026-09-21` | `6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07` | Compound model facts unchanged |
| Firebase | `firebase-instance-id-server-apis-decommission-2027-09-29` | `f2a9c271b91a2148c733bebb35274196c497f9a40fa062619fd94b3a31b3ee65` | scoped InstanceId info API facts unchanged |
| Google Cloud | `google-cloud-api-registry-mcp-shutdown-2026-07-30` | `e57f6568c8a4fecef9669740aa4c84fe6129afad6bba50064b76e1e454db8917` | MCP shutdown facts unchanged |
| MongoDB | `mongodb-atlas-m2-m5-serverless-eol-2026-01-22` | `ab5a10b04498f5f57019e97d2a8838e68828fdfe4dd8844b7b823e96f3a68a1d` | M2/M5 and Serverless facts unchanged |
| Databricks | `databricks-sql-legacy-api-deprecation-2026` | `6c6064fbace8d2302293ca34e69c667071ea6ae41d62424be00b79a028837563` | legacy SQL API facts unchanged |
| Snowflake | `snowflake-sql-api-old-functionality-disabled-future` | `7e22b23c8fd5a5c87bbac82eaaa7e11e9d52644caf2265855170416a24e9a2c3` | deprecated SQL API endpoint facts unchanged |
| Vercel | `vercel-legacy-integration-webhook-endpoints-removal-2021-08-20` | `1311464e47144d9460deffb84a1020e6753516218dc42f92dc7c86c613852633` | legacy integration endpoint facts unchanged |
| Datadog | `datadog-api-catalog-update-endpoint-deprecated` | `68030db4b6e92b160aa7376c18168e85bf6b22bd3969cc4a89702eb0a375b895` | API Catalog update endpoint facts unchanged |
| Cloudflare | `cloudflare-workers-kv-legacy-routes-2026-10-15` | `01e0a1778217b537b6432ec736b800c8d237b8bbc763e8f7f55c878e716a2627` | Workers KV legacy route facts unchanged |
| Microsoft Azure | `microsoft-azure-api-version-retirement-pre-2021-08-01-2024-06-01` | `85d5856d6532f44067704f60631012041b6548c47f3a048dfeee25cce9cc0a86` | pre-2021-08-01 API version facts unchanged |
| Square | `square-customer-cards-field-retired-2025-01-23` | `1df194b428312759a7a4f3d9e9a41c0e05f4739564c0f6d576d4ada3cf2f3b97` | source-backed Customer object scope added |
| Discord | `discord-social-sdk-default-scopes-removal-2025-03-26` | `c99e0ddafa9cc77626fb9e83e489d03b32241b93ac8835dde1d95f27c9777fe0` | default scopes method facts unchanged |
| Atlassian | `atlassian-admin-v1-users-groups-api-removal-2027-06-30` | `abe3f469b1927f7849dd6fc24741f08f235f056e5ddfd864b66006537b9deea4` | V1 users/groups removal facts unchanged |
| Auth0 | `auth0-enabled-clients-field-deprecation-2026-07-13` | `3835836ae02c82d5e414d17ad86855f943f836aef5c1f16ef75256bfe4c9b1e3` | source-backed connection endpoint scope added |
| Linear | `linear-mcp-sse-endpoint-removal-2026` | `886d0d2caf0dc3469186e040d813a2ea6ea793eacce60f066d1a26a7b8ae1eb6` | MCP SSE replacement facts unchanged |
| Deepgram | `deepgram-legacy-intelligence-parameters-2025-11-05` | `d30f49ed69413e0f234329b8b7fe9b253c70b622c4f4a91898d777a6a6f90079` | legacy parameter facts unchanged |
| Cohere | `cohere-embed-v2-model-retirement-2026-04-04` | `43cac8d4df00142fd69842679706f835789439aaec2bc7d00115a98fc09a5877` | Embed v2 and Aya model facts unchanged |
| Neon | `neon-api-reference-site-retirement` | `a59bf4fd028a18f70e93a7513cba4b747236a46ecce59a0f2d7eb0227684e1fd` | hosted-reference retirement facts unchanged; API unchanged |
| Algolia | `algolia-update-task-v1-deprecation` | `e07cbfc5ea3482885aea78b46a648aa314de223276d17ca303882d16c374c80d` | Update a task V1 deprecation unchanged |

## Review constraints

The source refresh does not broaden any applicability scope. In particular,
Firebase remains scoped to the captured InstanceId information endpoint, and
Neon remains a documentation-site retirement rather than a Neon API
retirement. Any future human decision must bind to the then-current candidate
and evidence fingerprints through the strict review workflow.

The non-persisted promotion-gate matrix accepts every source-complete candidate
in this packet. The separate Deepgram parameter candidate remains blocked: its
official source establishes deprecated parameters but does not establish an
authoritative operation, endpoint, resource, model, or domain. The strict
validator therefore rejects it rather than treating a parameter name as global
provider impact.

## Square proposed review action (not executed)

Candidate: `square-customer-cards-field-retired-2025-01-23`
Source: <https://developer.squareup.com/docs/changelog/connect-logs/2025-01-23>
Current scope: provider + resource + response_field + api_version. The source
identifies the Customer object, `Customer.cards`, and API version 2025-01-23
and later. Severity is high. No SDK/package/version claim is made.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Square's official changelog that the cards field on the Customer object is retired in API version 2025-01-23 and later, with ListCards and ListGiftCards as the documented replacement endpoints. I approve provider + resource + response_field + api_version applicability only. I do not assert an SDK package, SDK version, SDK method, or unrelated Cards API retirement.","sourceFingerprint":"1df194b428312759a7a4f3d9e9a41c0e05f4739564c0f6d576d4ada3cf2f3b97","evidenceFingerprint":"2356066a6bbcec4a1b8b6114caeb871c0fa5c5b48932e2c96568465c16cf8db0","candidateFingerprint":"9b63a3f2d2ac722b766210fb17d5b75ffdf6d4b597126e6bc71b52affbb0c8b8"}
```
