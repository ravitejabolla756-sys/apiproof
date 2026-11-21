# MY OWL V1 Overnight Test Results

Date: 2026-11-22

## Local verification

| Check | Result | Evidence boundary |
|---|---|---|
| TypeScript | PASS | Local source/type contract only |
| ESLint | PASS, zero warnings | Local static check |
| Focused role/auth/security regression | PASS, 4 files / 48 tests | Local test environment |
| Playwright | PASS, 37/37 | Disposable SQLite and loopback only |
| Full Vitest | PASS after environment rerun: 208 files, 1,618 passed, 17 skipped, 19 todo | Two blocked files passed in elevated local environment; no hosted PostgreSQL proof |
| Public capability copy contract | PASS | Source contract only |

## Full Vitest qualification

The first correctly seeded full run completed with 206 passed files, 3 skipped files and two Windows permission failures. The failures were `EACCES` on a loopback connection and `EPERM` while creating a Windows junction/symlink. The same two files passed in an elevated local rerun: `tests/contracts.test.ts` and `tests/safety.test.ts`, 11 tests total. The missing-seed run is invalid evidence and is not counted.

## Browser regression coverage added

- Compatibility API 503/malformed response is rendered as a retryable error, not an empty successful claims state.
- Repository and finding 404s render safe not-found/access-denied states.
- Login failures are announced through an alert region.
- Findings with active filters distinguish zero matches from an empty workspace.
- Failed scan history is not styled as successful.

## External evidence still missing

No hosted GitHub Actions run exists for the candidate because publication remains unauthorized by the current owner boundary. Real PostgreSQL 17.2 tenant isolation, RLS, grants, trusted worker identity, migration reconciliation, staging, backup/restore, rollback, monitoring and live external-provider evidence remain unverified.

