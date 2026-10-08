# Provider Intelligence Human Review Batch 3

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`
Purpose: proposed human actions only; no action below has been executed.

## Safety and validation status

Every candidate in this packet is still `needs_review`. Its current official
document was fetched in full, its candidate-specific evidence was normalized
deterministically, and a non-persisted reviewed projection passed the generic
promotion gate. The common compatibility benchmark proves static matching is
`AFFECTED`, unrelated complete evidence is `NOT_AFFECTED`, and dynamic evidence
is `NEEDS_REVIEW`. These are review-preparation results, not production claims.

No SDK package, SDK version, SDK method mapping, or dynamic wrapper behavior is
asserted unless shown as a source-backed applicability dimension below.

## Okta — risk provider and events API deprecation

- Candidate: `okta-risk-provider-and-events-api-deprecation`
- Official source: <https://developer.okta.com/docs/release-notes/2026/#okta-ai-risk-providers-api-deprecation>
- Facts: the Risk Provider and Risk Events APIs are deprecated; the documented replacements are Shared Signals Framework Security Event Tokens and an SSF Receiver.
- Scope: provider + resource (`Risk Provider API`, `Risk Events API`)
- Severity: high, from the generic removed/deprecated API policy.
- Unknown: SDK, endpoint, API-version, and package applicability.
- Document fingerprint: `70c4fafb127102780aadcc4ff7df502a30e50afa00bdc63b75cc43634c813e64`
- Evidence fingerprint: `dd641eae0e98274d3019610bc803aad6bbef948e7ac448d7d638a09ed5b66387`
- Candidate fingerprint: `5b017d3ee56c0d51723c065f20dddfae2f4461f5a8d51bc1f2e63c70f438b6ef`

```json
{
  "decision": "approve-for-promotion-review",
  "reviewer": "Ravi Teja",
  "reviewedAt": "2026-10-08",
  "notes": "I verified Okta's official release note for deprecation of the Risk Provider and Risk Events APIs. I approve provider + resource applicability only for those two APIs. The documented replacement direction is Shared Signals Framework Security Event Tokens and an SSF Receiver. I do not assert SDK package, SDK version, SDK method, endpoint, API version, or dynamic wrapper applicability.",
  "sourceFingerprint": "70c4fafb127102780aadcc4ff7df502a30e50afa00bdc63b75cc43634c813e64",
  "evidenceFingerprint": "dd641eae0e98274d3019610bc803aad6bbef948e7ac448d7d638a09ed5b66387",
  "candidateFingerprint": "5b017d3ee56c0d51723c065f20dddfae2f4461f5a8d51bc1f2e63c70f438b6ef"
}
```

## ElevenLabs — v1 model removal

- Candidate: `elevenlabs-v1-model-removal-2026-07-09`
- Official source: <https://elevenlabs.io/docs/changelog/2026/6/8>
- Facts: `eleven_monolingual_v1`, `eleven_multilingual_v1`, and `scribe_v1` are removed on 2026-07-09; documented replacements include v2 model variants.
- Scope: provider + model.
- Severity: high, from confirmed model removal.
- Unknown: SDK/package/version/operation scope.
- Document fingerprint: `c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a`
- Evidence fingerprint: `5ad9764c8d1c42c47c315e6075cc1f6b4fbcc311cb6ae122046014a17ded5667`
- Candidate fingerprint: `7c8612724d51d9238f0abe1b0e79da053031435986dfba24c5433813201f6a9d`

```json
{
  "decision": "approve-for-promotion-review",
  "reviewer": "Ravi Teja",
  "reviewedAt": "2026-10-08",
  "notes": "I verified ElevenLabs' official changelog for removal of eleven_monolingual_v1, eleven_multilingual_v1, and scribe_v1 on 2026-07-09, with the documented v2 replacement direction. I approve provider + model applicability only. I do not assert SDK package, SDK version, SDK method, endpoint, or dynamic model applicability.",
  "sourceFingerprint": "c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a",
  "evidenceFingerprint": "5ad9764c8d1c42c47c315e6075cc1f6b4fbcc311cb6ae122046014a17ded5667",
  "candidateFingerprint": "7c8612724d51d9238f0abe1b0e79da053031435986dfba24c5433813201f6a9d"
}
```

## Cloudflare — Service Key authentication removal

- Candidate: `cloudflare-service-key-auth-removal-2026-09-30`
- Official source: <https://developers.cloudflare.com/fundamentals/api/reference/deprecations/>
- Facts: `X-Auth-User-Service-Key` is removed on 2026-09-30; Cloudflare directs callers to API Tokens.
- Scope: provider + auth_or_header; generic change type `auth_or_header_removed`.
- Severity: high, from confirmed authentication mechanism removal.
- Unknown: endpoint, SDK, package, and version scope; no broad endpoint claim is made.
- Document fingerprint: `d42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9`
- Evidence fingerprint: `9abd5f0455c3333c23638475e04813a8d20c21c153d5c85e7ab9abc300348ca8`
- Candidate fingerprint: `e2d017c98bbd004f9101346c6f604102adc558cc468467ebf57dd92ae3f2abfb`

```json
{
  "decision": "approve-for-promotion-review",
  "reviewer": "Ravi Teja",
  "reviewedAt": "2026-10-08",
  "notes": "I verified Cloudflare's official API deprecation notice for removal of X-Auth-User-Service-Key on 2026-09-30 and the API Token replacement. I approve provider + auth_or_header applicability only for that exact header mechanism. I do not assert any endpoint, SDK package, SDK version, SDK method, or broader authentication behavior.",
  "sourceFingerprint": "d42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9",
  "evidenceFingerprint": "9abd5f0455c3333c23638475e04813a8d20c21c153d5c85e7ab9abc300348ca8",
  "candidateFingerprint": "e2d017c98bbd004f9101346c6f604102adc558cc468467ebf57dd92ae3f2abfb"
}
```

## Clerk — metadata fields removed from update endpoints

- Candidate: `clerk-api-2026-05-12-metadata-fields-removed`
- Official source: <https://clerk.com/docs/guides/development/upgrading/upgrade-guides/2026-05-12>
- Facts: API version 2026-05-12 removes `public_metadata`, `private_metadata`, and `unsafe_metadata` from the documented general-purpose update endpoints, with dedicated metadata endpoints as replacements.
- Scope: provider + endpoint + parameter.
- Severity: high, from source-backed parameter removal.
- Unknown: SDK/package/version/method scope beyond the stated API version.
- Document fingerprint: `cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a`
- Evidence fingerprint: `9c095e2e61e9d21a20a4f113c57d68a7b55e99819279765c49c1fdbfab856149`
- Candidate fingerprint: `34cbb038ef08d8663c4bf3118f4fb74fa987d44c6e182e124e45f4185813c4ba`

```json
{
  "decision": "approve-for-promotion-review",
  "reviewer": "Ravi Teja",
  "reviewedAt": "2026-10-08",
  "notes": "I verified Clerk's official 2026-05-12 upgrade guide for removal of public_metadata, private_metadata, and unsafe_metadata from the documented general-purpose update endpoints, with dedicated metadata endpoints as replacements. I approve provider + endpoint + parameter applicability only. I do not assert SDK package, SDK version, SDK method, or undocumented endpoint scope.",
  "sourceFingerprint": "cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a",
  "evidenceFingerprint": "9c095e2e61e9d21a20a4f113c57d68a7b55e99819279765c49c1fdbfab856149",
  "candidateFingerprint": "34cbb038ef08d8663c4bf3118f4fb74fa987d44c6e182e124e45f4185813c4ba"
}
```

## Groq — Compound model decommissioning

- Candidate: `groq-models-decommissioned-2026-09-21`
- Official source: <https://console.groq.com/docs/deprecations>
- Facts: `groq/compound` and `groq/compound-mini` were decommissioned on 2026-09-21.
- Scope: provider + model.
- Severity: high, from confirmed model decommissioning.
- Unknown: SDK/package/version/operation scope.
- Document fingerprint: `6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07`
- Evidence fingerprint: `ac3a75f4b550484539e211ead2529b8a3198160f0c8b82cbf7547d024e265b2b`
- Candidate fingerprint: `f524737bff543b5fdbb81b61d4767186b0d1a853828c4d791ca7f78526d13587`

```json
{
  "decision": "approve-for-promotion-review",
  "reviewer": "Ravi Teja",
  "reviewedAt": "2026-10-08",
  "notes": "I verified Groq's official deprecation documentation for decommissioning groq/compound and groq/compound-mini on 2026-09-21. I approve provider + model applicability only. I do not assert SDK package, SDK version, SDK method, endpoint, model alias, or dynamic model applicability.",
  "sourceFingerprint": "6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07",
  "evidenceFingerprint": "ac3a75f4b550484539e211ead2529b8a3198160f0c8b82cbf7547d024e265b2b",
  "candidateFingerprint": "f524737bff543b5fdbb81b61d4767186b0d1a853828c4d791ca7f78526d13587"
}
```

## Final readiness

These five candidates are `READY_FOR_HUMAN_APPROVAL`: source evidence is
fresh, the scope is complete, the generic promotion-gate dry run passes, and
the exact binding input is shown above. They remain unreviewed and absent from
the production compatibility registry until Ravi submits an explicit action.
