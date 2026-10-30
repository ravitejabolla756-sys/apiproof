import { describe, expect, it } from 'vitest';
import { runProductizationScan } from '@apiproof/analyzers';
import { productizationFindings } from '../apps/web/src/lib/server/productization-worker.js';

describe('Productization worker persistence projection', () => {
  it('keeps source bodies and fake secret values out of new findings', async () => {
    const secret = 'sk-test-secret-openai';
    const scan = await runProductizationScan({
      repositoryId: 'worker-secret-fixture', scanId: 'scan-secret', baselineSha: 'a'.repeat(64),
      files: {
        'package.json': JSON.stringify({ dependencies: { openai: '^4.0.0' } }),
        'src/client.ts': `import OpenAI from 'openai';\nconst key = '${secret}';\nconst client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\nclient.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });`,
      },
    });
    const findings = productizationFindings(scan);
    const serialized = JSON.stringify({ findings, proofs: scan.proofs, usageIR: scan.usageIR });
    expect(serialized).not.toContain(secret);
    expect(findings.every((finding) => finding.sourceSnippet === '')).toBe(true);
    expect(serialized).toContain('src/client.ts');

    const boundFindings = productizationFindings(scan, new Map([
      ['src/client.ts', `import OpenAI from 'openai';\nconst key = '${secret}';\nconst client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\nclient.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });`],
    ]));
    expect(boundFindings[0]?.sourceSnippet).toContain('chat.completions');
    expect(boundFindings[0]?.sourceSnippet).not.toContain(secret);
    expect(boundFindings[0]?.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(boundFindings[0]?.sourceDigest).not.toBe('a'.repeat(64));
  });
});
