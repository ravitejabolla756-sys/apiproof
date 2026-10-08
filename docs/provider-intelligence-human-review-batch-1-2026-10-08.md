# Provider Intelligence Human Review Batch 1

Date: 2026-10-08
Branch: `provider-intelligence-expansion-overnight`
Baseline checkpoint: `ad474d1`

## Safety boundary

This is source correction and revalidation only. No candidate was human-
approved or promoted. All five records remain `needs_review`; the production
reviewed registry remains exactly 10 rules: OpenAI (2), Anthropic (2), GitHub
(2), Twilio (2), and Supabase (2).

This was the batch baseline. The later local LaunchDarkly checkpoint increased
the registry to 13 rules; none of the five candidates below was promoted.

The complete official HTML bodies were fetched for the sources listed below and
fingerprinted with `fingerprintOfficialSource`. Candidate evidence was
extracted deterministically and fingerprinted with
`fingerprintCandidateEvidence`. No LLM summary was used as fingerprint input.

## Final revalidation summary

| Provider | Candidate after correction | Source classification | Analyzer coverage | Final status |
| --- | --- | --- | --- | --- |
| Slack | `slack-files-upload-removal-2025-11-12` | `EVIDENCE_UPDATED_REVIEW_REQUIRED` | operation IR supported | `READY_FOR_HUMAN_REVIEW` |
| Shopify | `shopify-checkout-api-shutdown-2025-04-01` | `EVIDENCE_UPDATED_REVIEW_REQUIRED` | resource IR supported | `READY_FOR_HUMAN_REVIEW` |
| LaunchDarkly | `launchdarkly-api-version-20220603-eol-2025-04-15` | `EVIDENCE_UPDATED_REVIEW_REQUIRED` | API-version IR supported | `READY_FOR_HUMAN_REVIEW` |
| GitLab | `gitlab-subscription-api-endpoints-removal` | `EVIDENCE_UPDATED_REVIEW_REQUIRED` | endpoint IR supported | `NEEDS_MORE_SOURCE_REVIEW` |
| AWS | `aws-cloudwatch-evidently-end-of-support-2025-10-16` | `EVIDENCE_UPDATED_REVIEW_REQUIRED` | resource IR supported | `READY_FOR_HUMAN_REVIEW` |

All five remain review-gated. “Ready” means the candidate has complete
source-backed facts and can receive an explicit human decision; it does not
mean that a compatibility finding or production record exists.

## Slack

- Old candidate: `slack-files-upload-removal-2025-03-11`
- New candidate: `slack-files-upload-removal-2025-11-12`
- Official source: <https://api.slack.com/changelog/2024-04-a-better-way-to-upload-files-is-here-to-stay>
- Source classification: `EVIDENCE_UPDATED_REVIEW_REQUIRED`
- Corrected facts: `files.upload` sunsets November 12, 2025; replacement is the sequenced `files.getUploadURLExternal` and `files.completeUploadExternal` flow.
- Change type: `method_removed`
- Applicability: provider + operation (`files.upload`)
- Severity: high; based on documented sunset/removal
- Unknowns: SDK package/version/method scope and dynamic wrappers are not asserted.
- Document fingerprint: `24840b8e5e4d093c41b747ba459cfb13444201061a6b1f3040df75da433cdd5f`
- Evidence fingerprint: `7bcaa779622bea78c632c52a2296c7c41bd7aa373887a784866743e501f3b6e9`
- Candidate fingerprint: `2d53d350d578f37984e7a579512ecc9ea9512fdc006733000cd05e7ff2883372`
- Test result: AFFECTED/NOT_AFFECTED/NEEDS_REVIEW operation fixtures pass; wrong-provider isolation passes.
- Final status: `READY_FOR_HUMAN_REVIEW`

The official article shows that an earlier March 11, 2025 date was revised to
November 12, 2025. [Slack source](https://api.slack.com/changelog/2024-04-a-better-way-to-upload-files-is-here-to-stay)

## Shopify

- Candidate: `shopify-checkout-api-shutdown-2025-04-01`
- Official source: <https://shopify.dev/changelog/posts/checkout-apis-will-be-shut-down-april-1-2025>
- Source classification: `EVIDENCE_UPDATED_REVIEW_REQUIRED`
- Facts: Storefront Checkout Mutations and REST Checkout Endpoints shut down April 1, 2025; replacements are Storefront Cart API and, for mobile apps, Checkout Sheet Kit.
- Change type: `endpoint_removed`
- Applicability: provider + resource; not Checkout UI Extensions, `checkout.liquid`, or unrelated Admin/Storefront APIs.
- Severity: high; based on documented shutdown
- Unknowns: SDK package/version/method scope and unrelated checkout surfaces are not asserted.
- Document fingerprint: `457d1ad1b98bcbcea39239da2ca2653844b4281da10ec3a90cf6f2629d6b9763`
- Evidence fingerprint: `b17a4c730c902d5b2a00e4f0bd4f26a276fec7bd132c2414b4d92194a21461e3`
- Candidate fingerprint: `a2584d6b181423c6b5a041045db2e09aaef817c4d4629da83bab3b2e64b732c7`
- Test result: affected resource, unrelated resource, dynamic resource, and wrong-provider fixtures pass.
- Final status: `READY_FOR_HUMAN_REVIEW`

The source explicitly distinguishes this shutdown from the separate
`checkout.liquid` to Checkout Extensibility transition. [Shopify source](https://shopify.dev/changelog/posts/checkout-apis-will-be-shut-down-april-1-2025)

## LaunchDarkly

- Old candidate: `launchdarkly-api-versions-retirement-2026-12-31`
- New candidate: `launchdarkly-api-version-20220603-eol-2025-04-15`
- Official source: <https://launchdarkly.com/docs/api/>
- Source classification: `EVIDENCE_UPDATED_REVIEW_REQUIRED`
- Corrected facts: API version `20220603` reached EOL April 15, 2025; `20240415` is the current replacement version.
- Change type: `api_version_retired`
- Applicability: provider + exact API version (`20220603`)
- Severity: high; based on explicit EOL
- Unknowns: the unsupported stored claim that all versions except `20240415` retire December 31, 2026 was removed; no SDK scope is asserted.
- Document fingerprint: `e7fc7da9aee943cb863b3f7dd995d452f8862a1373f0af3967cd3b3f23e55fda`
- Evidence fingerprint: `ef593fa2ae35eac21cabdc1e418361b7cfd7ba58c33f705399d885554346257d`
- Candidate fingerprint: `663aab621a5cfb1f53ec1b258499d41744f9c70308a1ee1b22c4a2e04108fdce`
- Test result: exact old version, replacement version, unknown version, and wrong-provider fixtures pass.
- Final status: `READY_FOR_HUMAN_REVIEW`

The unsupported December 31, 2026 broad claim is no longer retained. [LaunchDarkly source](https://launchdarkly.com/docs/api/)

## GitLab

- Old candidate: `gitlab-subscription-api-endpoints-removal-v5`
- New candidate: `gitlab-subscription-api-endpoints-removal`
- Official source: <https://docs.gitlab.com/update/deprecations/>
- Source classification: `EVIDENCE_UPDATED_REVIEW_REQUIRED`
- Corrected facts: nine exact subscription-related public REST endpoints are deprecated and slated for removal; GitLab says they were used internally and replaced by internal JWT-authenticated endpoints. The current source also says this change was removed from its original milestone and is being reassessed. No removal date is stated.
- Change type: `endpoint_removed`
- Applicability: provider + exact endpoint; no unsupported REST API v5 claim.
- Severity: medium; deprecation/removal is documented, but no date and no customer impact are stated.
- Unknowns: no removal date, SDK scope, or public replacement endpoint is asserted.
- Document fingerprint: `4533eaf82beac9bc8ca8e26f3a1d24088a0f64218133b893d4a8a54d24302521`
- Evidence fingerprint: `4414958bf7f3e0c7bc4962b5641dd118b4e1df584f8a487fdd144e63d8735a0d`
- Candidate fingerprint: `359c07f23bfe212dd4e974d81bfbdde82a74f417854498676bc07434dff46a54`
- Test result: exact endpoint, unrelated endpoint, dynamic endpoint, and wrong-provider fixtures pass.
- Final status: `NEEDS_MORE_SOURCE_REVIEW`

The “REST API v5” claim was removed because it was not supported by the
candidate-specific official source. [GitLab source](https://docs.gitlab.com/update/deprecations/)

## AWS

- Old candidate: `aws-cloudwatch-evidently-service-deprecation-2026-06-03`
- New candidate: `aws-cloudwatch-evidently-end-of-support-2025-10-16`
- Official source: <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/DocumentHistory.html>
- Source classification: `EVIDENCE_UPDATED_REVIEW_REQUIRED`
- Corrected facts: AWS announced October 17, 2024 that support for Amazon CloudWatch Evidently would end October 16, 2025; the console and Evidently resources would no longer be available after end of support.
- Change type: `endpoint_removed` as the closest existing resource-removal semantic
- Applicability: provider + resource (`Amazon CloudWatch Evidently`)
- Severity: high; based on explicit end of support/resource unavailability
- Unknowns: no replacement service, SDK package/version, or SDK operation is asserted.
- Document fingerprint: `d9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9`
- Evidence fingerprint: `3f83aa108bfe8fadff63add43c523a99b5b971d916e8510b4b4060ca49d4f64c`
- Candidate fingerprint: `b5d9edc8aa05ef59598bfe100656a3fe151af9c1b2f8111ddbf5e24f6b3c6d0d`
- Test result: affected resource, unrelated resource, dynamic resource, and wrong-provider fixtures pass.
- Final status: `READY_FOR_HUMAN_REVIEW`

The March 12, 2026 SDK integration-deprecation entry was not converted into a
removal date. The candidate now uses AWS’s separate explicit end-of-support
notice. [AWS source](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/DocumentHistory.html)

### Proposed AWS review action (not executed)

```json
{
  "decision": "approve-for-promotion-review",
  "reviewer": "Ravi Teja",
  "reviewedAt": "2026-10-08",
  "notes": "I verified AWS's official CloudWatch document history notice that support for Amazon CloudWatch Evidently ends on 2025-10-16 and that the console and Evidently resources become unavailable after end of support. I approve provider + resource applicability for Amazon CloudWatch Evidently only. I do not assert a replacement service, SDK package, SDK version, or SDK operation.",
  "sourceFingerprint": "d9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9",
  "evidenceFingerprint": "3f83aa108bfe8fadff63add43c523a99b5b971d916e8510b4b4060ca49d4f64c",
  "candidateFingerprint": "b5d9edc8aa05ef59598bfe100656a3fe151af9c1b2f8111ddbf5e24f6b3c6d0d"
}
```

### GitLab review boundary

GitLab is not ready for approval. The exact nine endpoints are documented as
deprecated, but the official page says the original removal milestone was
removed and the change is being reassessed. No stable removal date or public
replacement endpoint is proven. A human review input must not be submitted
until that source ambiguity is resolved. Current bindings are:

```text
documentFingerprint: 4533eaf82beac9bc8ca8e26f3a1d24088a0f64218133b893d4a8a54d24302521
evidenceFingerprint: 4414958bf7f3e0c7bc4962b5641dd118b4e1df584f8a487fdd144e63d8735a0d
candidateFingerprint: 359c07f23bfe212dd4e974d81bfbdde82a74f417854498676bc07434dff46a54
status: NEEDS_MORE_SOURCE_REVIEW
```

## Human-review boundary

No human review was executed and no reviewer metadata was added. The five
records are now structurally ready for explicit review inputs bound to their
current candidate fingerprints. Promotion remains a separate action and the
production registry is unchanged.

No Vercel, Supabase, staging, production, worker, credential, GitHub-write,
push, or deployment operation was performed.
