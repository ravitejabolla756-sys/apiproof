# V1 dependency-security checkpoint

## Policy

CI installs from `pnpm-lock.yaml` with `--frozen-lockfile`, then runs
`pnpm audit --prod --audit-level=high`. The audit is a gate for high and
critical advisories; it does not rewrite the lockfile or auto-fix dependencies.

## Reviewed local remediation

The integration lockfile was behind the approved Member 1 security baseline.
The reviewed direct ranges and overrides are:

- Next.js `^15.5.28`.
- Nodemailer `^10.1.4` (lockfile resolution `10.5.0`).
- PostCSS `8.5.28`.
- zod `^4.6.6`.
- `brace-expansion` override `5.0.12`.
- `minimatch` override `11.0.1`.
- `source-map-js` override `1.2.2`.

These changes address the observed high/critical dependency findings without
changing application authorization, migrations, providers or production
configuration.

## Local evidence

The pre-remediation audit observed 18 findings: 1 critical, 8 high and 9
moderate. After the reviewed Nodemailer and minimatch remediation, the local
production audit reported no known vulnerabilities, and the focused contract
suite, full typecheck, lint, web build and full local Vitest suite passed.

The configured audit command was also attempted after remediation, but the
environment could not refresh npm advisory metadata because registry access
failed with `ENOTFOUND`. A local pass is dependency-resolution evidence, not
hosted CI or production deployment evidence.

## Release gate

SEC-09 is release-ready locally. Before release approval, hosted CI must run
the frozen-lockfile install and `pnpm audit:prod` with current registry
metadata. Any newly reported advisory requires a risk-register entry with
package, advisory, affected path, exploitability context, mitigation and owner
disposition. No advisory is suppressed by this policy.
