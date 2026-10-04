import { describe, expect, it } from 'vitest';
import { GoRepositoryAnalyzer } from '@apiproof/analyzers';

const provider = { id: 'github', packageName: 'github.com/google/go-github', constructorExports: ['NewClient'], apiDomains: ['api.github.com'], environmentVariables: ['GITHUB_TOKEN'] };

describe('Go normalized discovery adapter', () => {
  it('detects go.mod/go.sum, imports, SDK calls, URLs, and environment access', async () => {
    const result = await new GoRepositoryAnalyzer().analyze(new Map([
      ['go.mod', 'module example.com/app\n\nrequire github.com/google/go-github/v60 v60.2.0\n'],
      ['go.sum', 'github.com/google/go-github/v60 v60.2.0 h1:abc\n'],
      ['client.go', 'package main\nimport (\n gh "github.com/google/go-github/v60/github"\n "net/http"\n "os"\n)\nfunc run() {\n client := gh.NewClient()\n client.Users.Get(nil, "octocat")\n http.Get("https://api.github.com/user")\n os.Getenv("GITHUB_TOKEN")\n}\n'],
    ]), provider);
    expect(result.providerUsed).toBe(true);
    expect(result.dependencies[0]?.versionResolution).toMatchObject({ version: '60.2.0', source: 'lockfile' });
    expect(result.usageIR?.some((usage) => usage.operation === 'gh.NewClient')).toBe(true);
    expect(result.usageIR?.some((usage) => usage.endpoint?.includes('api.github.com'))).toBe(true);
    expect(result.usageIR?.some((usage) => usage.parameters.includes('GITHUB_TOKEN'))).toBe(true);
  });

  it('does not match unrelated imports or malicious host suffixes', async () => {
    const result = await new GoRepositoryAnalyzer().analyze({ 'client.go': 'package main\nimport "github.com/google/go-github-fake/v60/github"\nvar url = "https://api.github.com.example.com/user"\n' }, provider);
    expect(result.providerUsed).toBe(false);
    expect(result.usages).toHaveLength(0);
  });
});
