import { describe, expect, it } from 'vitest';
import { CSharpRepositoryAnalyzer } from '@apiproof/analyzers';

const provider = { id: 'github', packageName: 'Octokit', packageNames: ['Octokit'], namespaceNames: ['Octokit'], constructorExports: ['GitHubClient'], apiDomains: ['api.github.com'], environmentVariables: ['GITHUB_TOKEN'] };

describe('C#/.NET normalized discovery foundation', () => {
  it('detects PackageReference, using declarations, SDK calls, URLs, and config', async () => {
    const result = await new CSharpRepositoryAnalyzer().analyze({ 'App.csproj': '<PackageReference Include="Octokit" Version="13.0.1" />', 'Client.cs': 'using Octokit; class ClientCode { void Run() { var client = new GitHubClient(); client.Repository.GetAllForCurrent(); var url = "https://api.github.com/user"; Environment.GetEnvironmentVariable("GITHUB_TOKEN"); } }' }, provider);
    expect(result.language).toBe('csharp');
    expect(result.dependencies[0]?.versionResolution).toMatchObject({ version: '13.0.1', source: 'declared-exact' });
    expect(result.usageIR?.some((usage) => usage.operation === 'new GitHubClient')).toBe(true);
    expect(result.usageIR?.some((usage) => usage.endpoint?.includes('api.github.com'))).toBe(true);
    expect(result.usageIR?.some((usage) => usage.parameters.includes('GITHUB_TOKEN'))).toBe(true);
  });

  it('rejects unrelated namespaces and malicious domains', async () => {
    const result = await new CSharpRepositoryAnalyzer().analyze({ 'Client.cs': 'using Contoso.Fake; var url = "https://api.github.com.example.com";' }, provider);
    expect(result.providerUsed).toBe(false);
    expect(result.usages).toHaveLength(0);
  });
});
