# APIProof Phase 7: GitHub proposal architecture

Phase 7 isolates source-control operations behind `SourceControlProvider`. The current implementation includes `FakeSourceControlProvider` for deterministic tests and keeps the production provider boundary ready for GitHub App authentication without adding Octokit or accepting personal access tokens.

The proposal gate requires an approved repository in `PROPOSE` mode, stable installation/repository identity, an unchanged analyzed base SHA, a fully verified contract proof level, and successful prior validation stages. It creates only an APIProof branch, writes authorized files, creates one commit, and opens a review PR. Merge, auto-merge, default-branch writes, force pushes, settings changes, deployments, releases, and secret operations are policy-forbidden.

The first live smoke command intentionally returns `LIVE_GITHUB_TEST_NOT_EXECUTED` until explicit allowlisted credentials and a dedicated fixture repository are configured. No GitHub network calls or webhook handlers are enabled by default.
