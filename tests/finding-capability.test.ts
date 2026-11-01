import { describe, expect, it } from 'vitest';
import { resolveFindingCapability, resolveReviewOnlyRemediation } from '../apps/web/src/lib/server/finding-capability.js';

const finding = { provider: 'twilio', changeId: 'twilio-regional-api-domain-removal-2026-04-28', filePath: 'src/client.ts', lineNumber: 12, symbol: 'client' };

describe('finding capability resolution', () => {
  it('requires the exact provider, change, and call-site location', () => {
    const projection = { schemaVersion: 2, baselineSha: 'abc', scanId: 'scan-1', compatibilityResults: [{ providerId: 'twilio', changeId: finding.changeId, exactFile: finding.filePath, exactLine: finding.lineNumber, exactSymbol: finding.symbol, recommendedNextAction: 'MIGRATION_AVAILABLE', migrationAvailable: true, verificationAvailable: true, evidenceCoverage: 'complete', reviewStatus: 'reviewed' }] };
    expect(resolveFindingCapability(projection, finding)).toMatchObject({ source: 'productization', migrationAvailable: true, recommendedNextAction: 'MIGRATION_AVAILABLE', baselineSha: 'abc', scanId: 'scan-1' });
    expect(resolveFindingCapability(projection, { ...finding, lineNumber: 13 })).toBeNull();
  });

  it('matches a normalized usage location when exact fields are absent', () => {
    const projection = { schemaVersion: 2, compatibilityResults: [{ providerId: 'twilio', changeId: finding.changeId, matchedUsages: [{ location: { file: finding.filePath, line: finding.lineNumber, symbol: finding.symbol } }], recommendedNextAction: 'MIGRATION_NOT_AVAILABLE', migrationAvailable: false, verificationAvailable: false }] };
    expect(resolveFindingCapability(projection, finding)).toMatchObject({ migrationAvailable: false, recommendedNextAction: 'MIGRATION_NOT_AVAILABLE' });
  });

  it('attaches candidate-specific manual guidance without making it executable', () => {
    const remediation = resolveReviewOnlyRemediation('slack', 'slack-files-upload-retired-2025-03-11');
    expect(remediation).toMatchObject({ mode: 'manual-guidance', templateId: expect.stringContaining('slack-files-upload-retired-2025-03-11') });
    expect(remediation?.steps.length).toBeGreaterThan(1);
    expect(remediation?.validation.length).toBeGreaterThan(1);
    expect(resolveReviewOnlyRemediation('slack', 'unknown-change')).toBeNull();
  });
});
