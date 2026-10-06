import { describe, expect, it } from 'vitest';
import { runProductizationScan } from '@apiproof/analyzers';

const repository = {
  'package.json': JSON.stringify({
    dependencies: {
      openai: '^4.0.0',
      '@anthropic-ai/sdk': '^0.30.0',
      '@octokit/rest': '^21.0.0',
      twilio: '^5.0.0',
      '@supabase/supabase-js': '^2.0.0',
    },
  }),
  'src/ai/client.ts': `
    import OpenAI from 'openai';
    import Anthropic from '@anthropic-ai/sdk';
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    export async function run() {
      await openai.chat.completions.create({ model: 'gpt-4.5-preview', messages: [] });
      await anthropic.messages.create({ model: 'claude-opus-4-1-20250805', max_tokens: 10, messages: [] });
    }
  `,
  'src/integrations/github.ts': `
    import { Octokit } from '@octokit/rest';
    export async function sbom(owner: string, repo: string) {
      return new Octokit().request('GET /{owner}/{repo}/dependency-graph/sbom', { owner, repo });
    }
  `,
  'src/integrations/twilio.ts': `
    import twilio from 'twilio';
    export async function studio(client: ReturnType<typeof twilio>) {
      return client.studio.v2.flows('flow').engagements.create({});
    }
  `,
  'src/integrations/supabase.ts': `
    import { createClient } from '@supabase/supabase-js';
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    export const logs = () => client.from('logs').select('*');
  `,
  'src/config.ts': `export const unrelated = 'gpt-4.5-preview';\nexport const dynamic = process.env.PROVIDER_MODEL;`,
};

describe('productization proof v1', () => {
  it('runs the local snapshot through discovery, IR, reviewed registry, and proof', async () => {
    const result = await runProductizationScan({ repositoryId: 'realistic-multi-provider', scanId: 'scan-001', files: repository });
    expect(result.coverage).toHaveLength(10);
    expect(result.discoveries.map((item) => item.providerId)).toEqual(['anthropic', 'github', 'openai', 'supabase', 'twilio']);
    expect(result.languages.find((item) => item.language === 'typescript')?.evidence.length).toBe(5);
    expect(result.privacy).toEqual({ externalAiRequired: false, rawSourceExternalTransmission: false, authoritativeDecision: 'deterministic-reviewed-registry' });
    expect(result.proofs.every((proof) => proof.repositoryId === 'realistic-multi-provider' && proof.baselineSha.length === 64)).toBe(true);
    expect(result.proofs.every((proof) => proof.provenance === 'official' && proof.reviewStatus === 'reviewed')).toBe(true);
    expect(result.timingsMs.total).toBeGreaterThanOrEqual(0);
  });

  it('keeps source contents out of the result contract', async () => {
    const result = await runProductizationScan({ repositoryId: 'privacy-fixture', scanId: 'scan-privacy', files: repository });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("process.env.OPENAI_API_KEY");
    expect(serialized).not.toContain("process.env.SUPABASE_ANON_KEY");
    expect(result.privacy.rawSourceExternalTransmission).toBe(false);
  });

  it('dispatches mixed TypeScript and Python repositories through the same reviewed registry', async () => {
    const result = await runProductizationScan({
      repositoryId: 'mixed-language',
      scanId: 'scan-mixed',
      files: {
        'requirements.txt': 'openai==1.0.0\nanthropic==0.30.0\n',
        'src/main.py': `
from openai import OpenAI
from anthropic import Anthropic
client = OpenAI()
client.chat.completions.create(model='gpt-4.5-preview', messages=[])
Anthropic().messages.create(model='claude-opus-4-1-20250805', max_tokens=10, messages=[])
`,
        'src/main.ts': repository['src/ai/client.ts'],
      },
    });
    expect(result.languages.map((item) => item.language)).toContain('python');
    expect(result.usageIR.some((usage) => usage.language === 'python')).toBe(true);
    expect(result.compatibilityResults.some((item) => item.changeId === 'openai-gpt-4-5-preview-removal-2025-07-14')).toBe(true);
    expect(result.compatibilityResults.some((item) => item.changeId === 'anthropic-claude-opus-4-1-retirement-2026-08-05')).toBe(true);
    expect(result.privacy.externalAiRequired).toBe(false);
  });
});
