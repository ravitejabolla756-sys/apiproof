import { describe, expect, it } from 'vitest';
import { runProductizationScan } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { productizationFindings } from '../apps/web/src/lib/server/productization-worker.js';
import { boundedProductizationProjection } from '../apps/web/src/lib/server/productization-persistence.js';
import { providerIntelligenceV1Enabled } from '../apps/web/src/lib/server/provider-intelligence-feature.js';

const CHANGE_ID = 'openai-gpt-4-5-preview-removal-2025-07-14';

describe('real staging OpenAI compatibility shape', () => {
  it('preserves the static responses.create model through production finding persistence', async () => {
    expect(providerIntelligenceV1Enabled({ PROVIDER_INTELLIGENCE_V1_ENABLED: 'true' })).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CHANGE_ID)).toBe(true);
    const result = await runProductizationScan({
      repositoryId: 'my-owl-staging-affected-openai',
      baselineSha: '6c2f63d797215c0505dc3b29d05a6e784b166bba',
      scanId: 'staging-openai-regression',
      files: {
        'package.json': JSON.stringify({ dependencies: { openai: '^4.0.0' } }),
        'src/index.ts': `
          import OpenAI from "openai";
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          async function run() {
            await client.responses.create({
              model: "gpt-4.5-preview",
              input: "MY OWL staging compatibility fixture"
            });
          }
          void run;
        `,
      },
    });

    const openaiUsage = result.usageIR.filter((usage) => usage.providerId === 'openai');
    const affected = result.compatibilityResults.find((item) => item.changeId === CHANGE_ID);
    const findings = productizationFindings(result).filter((finding) => finding.changeId === CHANGE_ID);
    const projection = boundedProductizationProjection(result);

    expect(openaiUsage).toEqual(expect.arrayContaining([
      expect.objectContaining({ model: 'gpt-4.5-preview', dynamic: false }),
    ]));
    expect(affected).toMatchObject({ changeId: CHANGE_ID, status: 'AFFECTED' });
    expect(findings).toHaveLength(1);
    expect((projection.compatibilityResults as Array<{ changeId: string; status: string }>).find((item) => item.changeId === CHANGE_ID)).toMatchObject({ status: 'AFFECTED' });
    expect((projection.usageIR as Array<{ model?: string; dynamic: boolean }>).find((usage) => usage.model === 'gpt-4.5-preview')).toMatchObject({ dynamic: false });
  });
});
