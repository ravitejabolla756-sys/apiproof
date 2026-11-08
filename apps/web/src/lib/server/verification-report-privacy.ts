import { VerificationReportSchema, type VerificationReport } from '@apiproof/shared';

const SAFE_WARNING_MESSAGES = new Set([
  'Fixture is not registered for execution.',
  'Production verification requires Docker execution.',
  'Fixture command manifest is not APIProof-controlled.',
  'Only statically validated candidates may execute.',
  'Deterministic offline dependency provisioning is required before Docker verification.',
  'Configured isolated checks only; this is not a guarantee of production safety.',
]);

const REDACTED_WARNING = 'Verification diagnostic details were redacted.';
const REDACTED_WORKSPACE = '[isolated verification workspace]';

/** Keep verification outcomes and digests while removing repository-controlled output. */
export function sanitizeVerificationReport(report: VerificationReport): VerificationReport {
  return VerificationReportSchema.parse({
    ...report,
    workspace: REDACTED_WORKSPACE,
    steps: report.steps.map((step) => ({ ...step, stdout: '', stderr: '' })),
    warnings: report.warnings.map((warning) => SAFE_WARNING_MESSAGES.has(warning) ? warning : REDACTED_WARNING),
  });
}

/** Safe response projection for reports persisted before output redaction was added. */
export function sanitizePersistedVerificationReport(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const wrapper: unknown = JSON.parse(raw);
    if (!wrapper || typeof wrapper !== 'object' || Array.isArray(wrapper)) return null;
    const value = wrapper as Record<string, unknown>;
    const parsedReport = VerificationReportSchema.safeParse(value.report);
    const failureReasons = Array.isArray(value.failureReasons)
      ? value.failureReasons.map(() => 'VERIFICATION_FAILED')
      : [];
    const safeWrapper: Record<string, unknown> = {
      schemaVersion: '1.0',
      report: parsedReport.success ? sanitizeVerificationReport(parsedReport.data) : null,
      failureReasons,
    };
    for (const key of [
      'migrationId', 'repositoryId', 'baselineSha', 'patchDigest', 'targetFiles',
      'sourceDigests', 'resultingDigests', 'evidence', 'failedAt',
    ]) {
      if (Object.hasOwn(value, key)) safeWrapper[key] = value[key];
    }
    return JSON.stringify(safeWrapper);
  } catch {
    return null;
  }
}
