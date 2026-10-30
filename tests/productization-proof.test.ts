import { describe, expect, it } from 'vitest';
import { runProductizationScan } from '@apiproof/analyzers';
import { DISCOVERY_PROVIDERS } from '@apiproof/providers';

const LAUNCH_PROVIDER_IDS = [
  'stripe', 'twilio', 'openai', 'firebase', 'github', 'aws', 'google-cloud', 'slack', 'sendgrid', 'shopify',
  'auth0', 'clerk', 'supabase', 'vercel', 'cloudflare', 'launchdarkly', 'elevenlabs', 'groq', 'braintree',
] as const;

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
  it('discovers all 19 launch providers and preserves explicit API versions for generic SDK imports', async () => {
    const definitions = LAUNCH_PROVIDER_IDS.map((providerId) => DISCOVERY_PROVIDERS.find((provider) => provider.id === providerId));
    expect(definitions.every((definition) => definition)).toBe(true);
    const providers = definitions.filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));
    expect(providers).toHaveLength(19);
    const dependencies = Object.fromEntries(providers.map((provider) => [provider.packageIdentifiers[0]!, '^1.0.0']));
    const source = providers.map((provider, index) => {
      const packageName = provider.packageIdentifiers[0]!;
      const version = `2027-${String((index % 12) + 1).padStart(2, '0')}`;
      return `import Client${index} from '${packageName}';\nconst client${index} = Client${index}({ apiVersion: '${version}' });`;
    }).join('\n');

    const result = await runProductizationScan({
      repositoryId: 'all-launch-providers',
      scanId: 'all-launch-providers-scan',
      files: { 'package.json': JSON.stringify({ dependencies }), 'src/clients.ts': source },
    });

    expect(new Set(result.discoveries.map((item) => item.providerId))).toEqual(new Set(LAUNCH_PROVIDER_IDS));
    const versionsByProvider = new Map(result.usageIR.filter((usage) => usage.apiVersion).map((usage) => [usage.providerId, usage.apiVersion]));
    expect(versionsByProvider.size).toBe(19);
    expect(new Set(versionsByProvider.keys())).toEqual(new Set(LAUNCH_PROVIDER_IDS));
  });

  it('runs the local snapshot through discovery, IR, reviewed registry, and proof', async () => {
    const result = await runProductizationScan({ repositoryId: 'realistic-multi-provider', scanId: 'scan-001', files: repository });
    expect(result.coverage).toHaveLength(50);
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

  it('dispatches Go, Java, Kotlin, and C# evidence through the productization path', async () => {
    const result = await runProductizationScan({
      repositoryId: 'cross-language-adapters',
      scanId: 'scan-cross-language-adapters',
      files: {
        'go.mod': 'module example.com/fixture\n\ngo 1.23\n',
        'cmd/service/main.go': `package main
import "os"
func key() string { return os.Getenv("OPENAI_API_KEY") }
`,
        'pom.xml': '<project><groupId>example</groupId><artifactId>fixture</artifactId><version>1.0.0</version></project>',
        'src/main/java/Fixture.java': `class Fixture {
  String key() { return System.getenv("OPENAI_API_KEY"); }
}
`,
        'src/main/kotlin/Fixture.kt': `class Fixture { fun key(): String = System.getenv("OPENAI_API_KEY") }
`,
        'Fixture.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
        'Fixture.cs': `using System;
class Fixture { string Key() => Environment.GetEnvironmentVariable("OPENAI_API_KEY"); }
`,
      },
    });

    expect(result.languages.map((item) => item.language)).toEqual(['csharp', 'go', 'java', 'kotlin']);
    expect(new Set(result.usageIR.map((usage) => usage.language))).toEqual(new Set(['csharp', 'go', 'java', 'kotlin']));
    expect(result.usageIR.filter((usage) => usage.providerId === 'openai')).toHaveLength(4);
    expect(result.compatibilityResults.filter((item) => item.providerId === 'openai')).toHaveLength(3);
    expect(result.compatibilityResults.filter((item) => item.providerId === 'openai' && item.reviewStatus === 'reviewed' && item.provenance === 'official')).toHaveLength(3);
    expect(result.proofs.filter((proof) => proof.providerId === 'openai' && proof.reviewStatus === 'reviewed' && proof.provenance === 'official')).toHaveLength(3);
    expect(result.usageIR.every((usage) => usage.location.line > 0 && usage.confidence > 0)).toBe(true);
    expect(result.privacy.externalAiRequired).toBe(false);
  });

  it('does not reinterpret JavaScript package names as foreign-language dependencies', async () => {
    const result = await runProductizationScan({
      repositoryId: 'foreign-package-boundary',
      baselineSha: 'd'.repeat(40),
      scanId: 'foreign-package-boundary-scan',
      files: new Map([
        ['go.mod', 'module example.com/app\n\ngo 1.22\n\nrequire openai v1.0.0'],
        ['src/client.go', 'package client\n\nimport "openai"\n\nfunc call() { openai.ChatCompletion() }'],
        ['pom.xml', '<project><dependencies><dependency><groupId>openai</groupId><artifactId>openai</artifactId><version>1.0.0</version></dependency></dependencies></project>'],
        ['src/Client.java', 'package client; import openai.Client; class Client { void call() { Client.chat(); } }'],
      ]),
    });
    expect(result.usageIR).toHaveLength(0);
    expect(result.compatibilityResults).toHaveLength(0);
  });

  it('keeps cross-language usage and proof ordering deterministic across repeated scans', async () => {
    const files = {
      'go.mod': 'module example.com/fixture\n\ngo 1.23\n',
      'main.go': 'package main\nimport "os"\nfunc key() string { return os.Getenv("OPENAI_API_KEY") }\n',
      'src/main.java': 'class Fixture { String key() { return System.getenv("OPENAI_API_KEY"); } }\n',
    };
    const first = await runProductizationScan({ repositoryId: 'deterministic-cross-language', scanId: 'scan-a', files });
    const second = await runProductizationScan({ repositoryId: 'deterministic-cross-language', scanId: 'scan-a', files });
    const projection = (result: typeof first) => ({
      usageIR: result.usageIR.map((usage) => [usage.language, usage.id, usage.providerId, usage.location.file, usage.location.line]),
      proofs: result.proofs.map((proof) => [proof.providerId, proof.changeId, proof.status, proof.exactFile, proof.exactLine]),
    });
    expect(projection(second)).toEqual(projection(first));
  });
});
