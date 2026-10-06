import { describe, expect, it } from 'vitest';
import { runProductizationScan } from '@apiproof/analyzers';

const source = `import OpenAI from 'openai';\nconst client = new OpenAI();\nclient.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });\n`;
const makeFiles = (count: number): Record<string, string> => ({
  'package.json': JSON.stringify({ dependencies: { openai: '^4.0.0' } }),
  ...Object.fromEntries(Array.from({ length: count }, (_, index) => [`src/file-${index}.ts`, source])),
});

describe('productization local performance proof', () => {
  it('measures deterministic small, medium, and large in-memory scans', async () => {
    const measurements = [];
    for (const [size, count] of [['small', 3], ['medium', 20], ['large', 80]] as const) {
      const first = await runProductizationScan({ repositoryId: `perf-${size}`, scanId: `perf-${size}-1`, files: makeFiles(count) });
      const second = await runProductizationScan({ repositoryId: `perf-${size}`, scanId: `perf-${size}-2`, files: makeFiles(count) });
      measurements.push({ size, files: first.metrics.totalFiles, timingsMs: first.timingsMs, findings: first.metrics.findings });
      expect(first.metrics.totalFiles).toBe(count + 1);
      expect(first.coverage).toEqual(second.coverage);
      expect(first.compatibilityResults.map((item) => [item.changeId, item.status])).toEqual(second.compatibilityResults.map((item) => [item.changeId, item.status]));
      expect(first.timingsMs.total).toBeGreaterThanOrEqual(0);
    }
    console.log(`PRODUCTIZATION_PERFORMANCE ${JSON.stringify(measurements)}`);
    expect(measurements).toHaveLength(3);
  });
});
