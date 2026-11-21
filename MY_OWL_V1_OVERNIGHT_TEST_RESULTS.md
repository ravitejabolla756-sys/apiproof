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

## External-state recheck

On 2026-11-22, GitHub branch search returned no candidate branch and combined-status lookups returned no checks for either `857a6ea19b1187ea0336a3e81b13e7faaf4cbc3d` or local HEAD `74650dbef26c96366a4df40ced7c8e43df302b47`. Vercel returned zero deployments for the current SHA in all three linked projects. This confirms the candidate remains unpublished and has not triggered hosted CI or Vercel deployment.

