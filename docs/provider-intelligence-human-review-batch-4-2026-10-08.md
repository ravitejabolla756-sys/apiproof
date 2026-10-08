# Provider Intelligence Human Review Batch 4

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`
Purpose: prepared inputs only; no review action or promotion was executed.

## Validation boundary

These records remain `needs_review`. Their full official source bodies were
freshly fingerprinted, candidate-specific evidence remains source-backed, and
the generic non-persisted promotion-gate matrix passes for each. The normalized
IR compatibility benchmark covers `AFFECTED`, `NOT_AFFECTED`, and
`NEEDS_REVIEW` semantics. No SDK/package/version applicability is inferred.

## Firebase

Candidate: `firebase-instance-id-server-apis-decommission-2027-09-29`
Source: <https://firebase.google.com/docs/cloud-messaging/troubleshooting>
Facts: the captured InstanceId information endpoint `https://iid.googleapis.com/iid/info` is part of the InstanceId server API decommission on 2027-09-29; Firebase directs users to upgrade the Admin SDK.
Scope: provider + endpoint. Severity: high.
Unknown: package/version/method and any uncaptured InstanceId endpoint.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Firebase's official FCM deprecation notice for decommissioning the captured InstanceId information endpoint on 2027-09-29. I approve provider + endpoint applicability only for https://iid.googleapis.com/iid/info. I do not assert SDK package, SDK version, SDK method, or other InstanceId endpoint scope.","sourceFingerprint":"f2a9c271b91a2148c733bebb35274196c497f9a40fa062619fd94b3a31b3ee65","evidenceFingerprint":"29b85940142f39c5a0c91304295ea7d18090d2ead4eaf1c011e2ea6beb2a4ab4","candidateFingerprint":"e2ed8f337cb795df1b61c6b8e13ef6a4ff45c5124295a34c6cc7cbbecdf116d0"}
```

## Google Cloud

Candidate: `google-cloud-api-registry-mcp-shutdown-2026-07-30`
Source: <https://docs.cloud.google.com/api-registry/release-notes>
Facts: API Registry support for MCP servers and tools was shut down on 2026-07-30; the source directs use of supported MCP endpoints after enabling the API.
Scope: provider + resource (`API Registry MCP servers and tools`). Severity: high.
Unknown: package/version/method/endpoint scope.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Google Cloud's official API Registry release note for shutdown of API Registry MCP servers and tools on 2026-07-30. I approve provider + resource applicability only. I do not assert SDK package, SDK version, SDK method, endpoint, or unrelated Google Cloud MCP scope.","sourceFingerprint":"e57f6568c8a4fecef9669740aa4c84fe6129afad6bba50064b76e1e454db8917","evidenceFingerprint":"7c2b692277ed354aefda6100fcd9796c7c3534010450bce5c6269457c8a5cec4","candidateFingerprint":"ece56605780bdbce9771ba7af275a81a1018a51e4645fb8724dc883280dfa3d4"}
```

## MongoDB

Candidate: `mongodb-atlas-m2-m5-serverless-eol-2026-01-22`
Source: <https://www.mongodb.com/docs/atlas/flex-migration/>
Facts: Atlas M2/M5 clusters and Serverless instances reached end of life on 2026-01-22; Flex clusters are the documented replacement.
Scope: provider + resource. Severity: high.
Unknown: package/version/API operation scope.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified MongoDB Atlas's official Flex migration guidance for end of life of Atlas M2/M5 clusters and Serverless instances on 2026-01-22, with Flex clusters as the replacement. I approve provider + resource applicability only. I do not assert SDK package, SDK version, API operation, endpoint, or unrelated Atlas resource scope.","sourceFingerprint":"ab5a10b04498f5f57019e97d2a8838e68828fdfe4dd8844b7b823e96f3a68a1d","evidenceFingerprint":"e2540710c43afe19cbd2f5beaba49a2ee794cce09fe39e7cb9deffd674265093","candidateFingerprint":"d4bd8481769ee3bced89fe78a4336da92131590e053ae5f99a3b9e8c6a9d5217"}
```

## Databricks

Candidate: `databricks-sql-legacy-api-deprecation-2026`
Source: <https://docs.databricks.com/aws/en/sql/dbsql-api-latest>
Facts: legacy Databricks SQL APIs, including the documented legacy query/permissions/data-source surfaces, are deprecated; latest Queries, Alerts, and Workspace APIs are the documented direction.
Scope: provider + resource (`Databricks legacy SQL APIs`). Severity: high.
Unknown: a universal removal date, package/version/method scope.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Databricks' official legacy SQL API migration documentation. I approve provider + resource applicability only for the documented legacy SQL API surface. I do not assert SDK package, SDK version, SDK method, a universal removal date, or undocumented endpoints.","sourceFingerprint":"6c6064fbace8d2302293ca34e69c667071ea6ae41d62424be00b79a028837563","evidenceFingerprint":"dc8dbfb82407e4937739972cbe8a9ec44be7636fe9664cd2c31168c6b95b48db","candidateFingerprint":"f316ef5525a0c7f8368090e8bc6e22741f54b2361c589f1c5fc71d31558c908b"}
```

## Snowflake

Candidate: `snowflake-sql-api-old-functionality-disabled-future`
Source: <https://docs.snowflake.com/en/developer-guide/sql-api/sql-api-old>
Facts: deprecated SQL API functionality at the captured statement endpoints is unsupported and will be disabled in a future release; callers should use the current SQL API.
Scope: provider + endpoint. Severity: high.
Unknown: a specific removal date, package/version/method scope.

```json
{"decision":"approve-for-promotion-review","reviewer":"Ravi Teja","reviewedAt":"2026-10-08","notes":"I verified Snowflake's official deprecated SQL API documentation for the captured statement endpoint functionality. I approve provider + endpoint applicability only. I do not assert SDK package, SDK version, SDK method, a specific removal date, or broader SQL API applicability.","sourceFingerprint":"7e22b23c8fd5a5c87bbac82eaaa7e11e9d52644caf2265855170416a24e9a2c3","evidenceFingerprint":"6a6f64373843d0533c57f770087c6b749d77e42a56876bf698186f5e38fa422a","candidateFingerprint":"0a896d60280da6c42825253868a63656fe7dfc1079d3cf8a6393d5afc7939394"}
```

## Final readiness

All five are `READY_FOR_HUMAN_APPROVAL` for their stated, bounded scopes only.
They remain outside the reviewed production registry until an explicit human
decision is submitted through `reviewCandidate()`.
