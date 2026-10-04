import { describe, expect, it } from 'vitest';
import { JavaRepositoryAnalyzer, KotlinRepositoryAnalyzer } from '@apiproof/analyzers';

const provider = { id: 'github', packageName: 'com.github.sdk', coordinates: ['com.github:sdk'], packageNames: ['com.github.sdk'], constructorExports: ['Client'], apiDomains: ['api.github.com'], environmentVariables: ['GITHUB_TOKEN'] };

describe('Java/Kotlin normalized discovery foundation', () => {
  it('detects Maven dependencies and Java static evidence', async () => {
    const result = await new JavaRepositoryAnalyzer().analyze({ 'pom.xml': '<dependency><groupId>com.github</groupId><artifactId>sdk</artifactId><version>1.2.3</version></dependency>', 'Client.java': 'import com.github.sdk.Client; class ClientCode { void run() { Client.create(); java.net.http.HttpClient.newHttpClient(); System.getenv("GITHUB_TOKEN"); } }' }, provider);
    expect(result.language).toBe('java');
    expect(result.dependencies[0]?.versionResolution).toMatchObject({ version: '1.2.3', source: 'declared-exact' });
    expect(result.usageIR?.some((usage) => usage.operation === 'Client.create')).toBe(true);
    expect(result.usageIR?.some((usage) => usage.parameters.includes('GITHUB_TOKEN'))).toBe(true);
  });

  it('detects Gradle dependencies and Kotlin static URLs', async () => {
    const result = await new KotlinRepositoryAnalyzer().analyze({ 'build.gradle.kts': 'implementation("com.github:sdk:2.0.0")', 'Client.kt': 'import com.github.sdk.Client\nval url = "https://api.github.com/user"' }, provider);
    expect(result.language).toBe('kotlin');
    expect(result.dependencies[0]?.versionResolution?.version).toBe('2.0.0');
    expect(result.usageIR?.some((usage) => usage.endpoint?.includes('api.github.com'))).toBe(true);
  });

  it('rejects unrelated package names and malicious domains', async () => {
    const result = await new JavaRepositoryAnalyzer().analyze({ 'Client.java': 'import com.github.fake.Client; String url = "https://api.github.com.example.com";' }, provider);
    expect(result.providerUsed).toBe(false);
    expect(result.usages).toHaveLength(0);
  });
});
