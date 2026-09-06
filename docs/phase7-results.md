# APIProof 0.7.0 Phase 7 results

The fake GitHub evaluation contains 20 scenarios and produced 20/20 correct final statuses. It created one synthetic branch, commit, and PR; rejected stale bases; prevented duplicate proposals; accepted zero default-branch writes, merge operations, or force pushes; and recorded zero unauthorized writes, token leaks, or secret leaks.

The proposal path uses deterministic branch names such as `apiproof/stripe/stripe-subscription-coupon-removed/run001`, a concise title, a machine-readable provenance comment, and a proof body rendered from structured evidence. Every body states that human review is required and that APIProof will not merge or deploy.

Live GitHub smoke testing is **NOT EXECUTED** because no explicit allowlisted installation credentials or dedicated fixture repository were configured. Docker remains **NOT EXECUTED** because the daemon is unavailable.
