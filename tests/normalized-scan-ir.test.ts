import { describe, expect, it } from 'vitest';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';

describe('TypeScript scan normalized IR projection', () => {
  it('emits IR alongside the legacy scan usage contract', async () => {
    const analyzer = new TypeScriptRepositoryAnalyzer();
    const result = await analyzer.analyze({
      'package.json': JSON.stringify({ dependencies: { openai: '4.2.0' } }),
      'src/ai.ts': "import OpenAI from 'openai';\nconst client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\nclient.responses.create({ model: 'gpt-4.1', input: 'hello' });",
    }, { id: 'openai', packageName: 'openai', constructorExports: ['default'] });
    expect(result.usages.length).toBeGreaterThan(0);
    expect(result.usageIR?.length).toBe(result.usages.length);
    expect(result.usageIR?.some((usage) => usage.providerId === 'openai' && usage.packageName === 'openai' && usage.location.file === 'src/ai.ts')).toBe(true);
    expect(result.usages).toBeDefined();
  });
});
