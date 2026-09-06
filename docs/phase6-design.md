# APIProof Phase 6: Behavioral Contract Verification

Phase 6 adds deterministic behavioral checks for API migrations that are already statically analyzed and patched. A contract scenario describes the entrypoint, expected operation, normalized request assertions, response assertions, and behavior assertions. Reports preserve assertion evidence, structured differences, provenance digests, and `requiresHumanReview: true`.

The harness boundary is deliberately narrow: `LocalContractHarness` binds only to loopback, captures at most 20 interactions, bounds request bodies at 65,536 bytes, and stores only redacted authorization metadata. The evaluation corpus uses `FakeContractHarness`; it never executes customer code, starts external services, or makes network calls. Unsupported wrappers, response-only claims without evidence, and external-runtime requirements produce explicit refusal statuses.
