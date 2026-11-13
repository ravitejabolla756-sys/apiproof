# SEC-18 incident response runbook

Status: `IMPLEMENTED_EXTERNAL_VERIFICATION_PENDING`

This runbook defines the response boundary for MY OWL V1 incidents. It is an
operational procedure, not evidence that an on-call rotation, alert provider,
staging environment, backup, or rollback rehearsal has been configured.

## Required ownership before activation

The release owner must record the following in the release evidence package:

- Incident commander: ____________________
- Security owner: ____________________
- Deployment/rollback operator: ____________________
- Customer/support contact: ____________________
- Evidence-retention location: ____________________
- Approved communication channel: ____________________
- Approved severity and escalation policy: ____________________

Blank fields are a release blocker. Do not infer ownership from repository
permissions or from the person who discovers an incident.

## Severity and first response

1. Open an incident record with UTC start time, reporter, affected release
   commit, observed impact, and a sanitized evidence reference.
2. Assign an incident commander and security owner before changing production
   configuration or data.
3. Preserve logs, request IDs, deployment identifiers, migration-ledger
   evidence, and relevant queue/health snapshots. Do not copy cookies, tokens,
   credentials, private source, customer payloads, or raw authorization
   headers into the record.
4. Classify the incident using the owner-approved policy. Until that policy is
   approved, treat suspected tenant isolation, credential exposure, or
   unauthorized repository access as security incidents requiring immediate
   escalation.

## Containment boundaries

Use the smallest reversible control that stops further impact:

- disable the affected feature flag or scheduled worker invocation;
- revoke the affected provider installation or integration through the
  approved provider control plane;
- block the affected route or workspace scope through the approved release
  control;
- pause outbound notification/payment delivery when delivery integrity is in
  doubt.

Do not delete findings, repositories, accounts, invoices, audit events or
migration records as a containment action. Do not reset, rename, replay or
manually edit applied migrations. Do not rotate a credential in this runbook
unless the credential owner authorizes the rotation through the approved
secret-management procedure.

## Investigation and evidence

Record only the minimum data needed to establish scope:

- release commit and deployment identifier;
- route, worker, provider, workspace and repository identifiers where needed;
- sanitized error category, request/job ID and UTC timestamps;
- affected migration identity and ledger status, if relevant;
- tenant-isolation, authorization, billing, notification and backup/restore
  observations;
- commands or console actions used by the operator.

Hash or redact sensitive payloads. Preserve the original evidence in the
approved restricted location and record its retention class; never attach
secrets or personal data to an issue or chat message.

## Recovery and rollback

The incident commander must select one approved recovery path and record the
decision before execution:

1. Roll back to the last approved application release when the defect is
   release-local and the database contract is unchanged.
2. Disable the affected feature flag when the flag is an independently
   reversible boundary.
3. Restore only through the approved backup/restore procedure when data
   integrity is in question.

A rollback must not rewrite Git history, delete migration-ledger rows, replay
ambiguous migrations, or alter customer records to hide impact. Afterward,
verify health, authentication, authorization/tenant scope, queue state and
the affected user journey in the approved nonproduction or production
procedure appropriate to the incident. Record actual timestamps and results.

## Closure criteria

Close the incident only when the incident commander and security owner have
recorded:

- confirmed scope and affected tenants/resources;
- containment and recovery actions with operators and UTC timestamps;
- customer/support communication decision;
- data-integrity and credential-impact assessment;
- follow-up defects, owners and due dates;
- whether a backup/restore, migration, provider, legal or security review is
  required before the next release.

The release remains `NO-GO` when required evidence, owner approval, rollback
authority, or incident communications are missing.
