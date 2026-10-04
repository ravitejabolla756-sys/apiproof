import { describe, expect, it } from 'vitest';
import { PythonRepositoryAnalyzer } from '@apiproof/analyzers';

const provider = { id: 'openai', packageName: 'openai', constructorExports: ['OpenAI'], apiDomains: ['api.openai.com'], environmentVariables: ['OPENAI_API_KEY'] };

describe('Python normalized discovery adapter', () => {
  it('detects requirements, lock resolution, imports, SDK calls, HTTP, and env evidence', async () => {
    const result = await new PythonRepositoryAnalyzer().analyze(new Map([
      ['requirements.txt', 'openai>=1.0\n'],
      ['uv.lock', '[[package]]\nname = "openai"\nversion = "1.2.3"\n'],
      ['src/client.py', 'import openai as ai\nfrom os import getenv\nclient = ai.OpenAI()\nclient.chat.completions.create(model="gpt-4")\nrequests.post("https://api.openai.com/v1/responses")\nkey = getenv("OPENAI_API_KEY")\n'],
    ]), provider);
    expect(result.providerUsed).toBe(true);
    expect(result.dependencies[0]?.versionResolution).toMatchObject({ version: '1.2.3', source: 'lockfile' });
    expect(result.usageIR?.some((usage) => usage.operation?.includes('chat.completions.create'))).toBe(true);
    expect(result.usageIR?.some((usage) => usage.endpoint?.includes('api.openai.com'))).toBe(true);
    expect(result.usageIR?.some((usage) => usage.parameters.includes('OPENAI_API_KEY') && usage.evidence.some((evidence) => evidence.detail === 'OPENAI_API_KEY'))).toBe(true);
  });

  it('does not match unrelated imports or domains', async () => {
    const result = await new PythonRepositoryAnalyzer().analyze({ 'src/client.py': 'import openai_fake\nrequests.get("https://api.openai.com.example.com/v1")\n' }, provider);
    expect(result.providerUsed).toBe(false);
    expect(result.usages).toHaveLength(0);
  });
});
