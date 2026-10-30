import { describe, expect, it } from 'vitest';
import { runProductizationScan, type ProductizationScanResult } from '@apiproof/analyzers';
import { boundedProductizationProjection, parseBoundedProductizationProjection, PRODUCTIZATION_MAX_JSON_BYTES } from '../apps/web/src/lib/server/productization-persistence.js';
import { productizationFindings } from '../apps/web/src/lib/server/productization-worker.js';
import { formatLogEntry, redactSensitiveData } from '../apps/web/src/lib/server/logger.js';

const RAW_MARKER = 'RAW_SOURCE_MUST_NEVER_LEAK_987654321';
const SECRETS = [
  'openai-fixture-value-987',
  'anthropic-fixture-value-987',
  'twilio-fixture-value-987',
  'supabase-fixture-value-987',
  'github-fixture-value-987',
];

describe('provider-intelligence privacy and bounded persistence', () => {
  it('keeps raw source markers out of the real productization result and legacy finding envelope', async () => {
    const scan = await runProductizationScan({
      repositoryId: 'privacy-fixture',
      baselineSha: 'a'.repeat(40),
      scanId: 'scan-privacy',
      files: new Map([
        ['package.json', JSON.stringify({ dependencies: { openai: '4.0.0' } })],
        ['src/client.ts', `// ${RAW_MARKER}\nconst note = '${RAW_MARKER}';\nfunction helper() { return ${JSON.stringify(RAW_MARKER)}; }\nimport OpenAI from 'openai';\nconst client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\nclient.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });`],
        ['src/unrelated.ts', `export const unrelated = '${RAW_MARKER}';`],
      ]),
    });
    const projection = boundedProductizationProjection(scan);
    const findingEnvelope = productizationFindings(scan);
    expect(JSON.stringify(projection)).not.toContain(RAW_MARKER);
    expect(JSON.stringify(findingEnvelope)).not.toContain(RAW_MARKER);
    expect(JSON.stringify(projection)).toContain('AFFECTED');
    expect(scan.metrics.totalFiles).toBe(3);
  });

  it('keeps fake secret values out of projections, logs, and sanitized advisory-shaped data while retaining names', () => {
    const advisory = { envName: 'OPENAI_API_KEY', value: SECRETS[0], authorization: SECRETS[4], note: RAW_MARKER };
    const sanitized = redactSensitiveData(advisory);
    const log = formatLogEntry('error', `scan failed ${SECRETS[0]} ${RAW_MARKER}`, { repositoryId: 'repo-privacy', secretName: 'TWILIO_AUTH_TOKEN' }, new Error(SECRETS[2]));
    expect(JSON.stringify(sanitized)).not.toContain(SECRETS[0]);
    expect(JSON.stringify(sanitized)).not.toContain(SECRETS[4]);
    expect(JSON.stringify(sanitized)).toContain('OPENAI_API_KEY');
    expect(log).not.toContain(SECRETS[0]);
    expect(log).not.toContain(SECRETS[2]);
    expect(log).not.toContain(RAW_MARKER);
    expect(log).toContain('TWILIO_AUTH_TOKEN');
  });

  it('rejects oversized persisted projections instead of silently dropping required evidence', () => {
    const usage = Array.from({ length: 30_000 }, (_, index) => ({
      id: `usage-${index}`,
      language: 'typescript',
      providerId: 'openai',
      dynamic: false,
      confidence: 1,
      location: { file: `src/file-${index}.ts`, line: 1, column: 1, symbol: 'model' },
      evidence: [],
    }));
    const scan = {
      repositoryId: 'bounds-fixture', baselineSha: 'b'.repeat(40), scanId: 'scan-bounds',
      languages: [], discoveries: [], usageIR: usage, compatibilityResults: [], proofs: [], coverage: [],
      timingsMs: { discovery: 1, analysis: 1, compatibility: 1, proof: 1, total: 4 },
      metrics: { totalFiles: 30_000, analyzedFiles: 30_000, providerEvidenceNodes: 0, normalizedUsages: usage.length, reviewedChangesConsidered: 10, findings: 0 },
      privacy: { externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' },
    } as unknown as ProductizationScanResult;
    expect(PRODUCTIZATION_MAX_JSON_BYTES).toBe(1_500_000);
    expect(() => boundedProductizationProjection(scan)).toThrow('PROVIDER_INTELLIGENCE_EVIDENCE_LIMIT');
  });

  it('rejects oversized or malformed persisted payloads at every read boundary', () => {
    expect(parseBoundedProductizationProjection({ schemaVersion: 1, compatibilityResults: [], proofs: [] })).toBeNull();
    expect(parseBoundedProductizationProjection({ schemaVersion: 2, compatibilityResults: [], proofs: [], padding: 'x'.repeat(PRODUCTIZATION_MAX_JSON_BYTES) })).toBeNull();
  });
});
