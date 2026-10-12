import { describe, expect, it } from 'vitest';
import { DISCOVERY_PROVIDERS, DISCOVERY_PROVIDER_REGISTRY, PROVIDER_CATALOG_SUMMARY, compileProviderRegistry, validateProviderDefinitions } from '@apiproof/providers';
import { discoverProviders, resolvePackageVersions } from '@apiproof/analyzers';
import { scanResultWithDiscovery } from '../apps/web/src/lib/server/scan-discovery-evidence.js';

const scan = (files: Record<string, string>) => discoverProviders(new Map(Object.entries(files)), DISCOVERY_PROVIDER_REGISTRY);

describe('provider registry and TS/JS discovery', () => {
  it('has a unique catalog with discovery and generic version awareness only', () => {
    expect(DISCOVERY_PROVIDERS).toHaveLength(150);
    expect(() => validateProviderDefinitions(DISCOVERY_PROVIDERS)).not.toThrow();
    expect(new Set(DISCOVERY_PROVIDERS.map((item) => item.id)).size).toBe(DISCOVERY_PROVIDERS.length);
    expect(DISCOVERY_PROVIDERS.every((item) => item.displayName && item.capabilities.includes('discovery'))).toBe(true);
    expect(DISCOVERY_PROVIDERS.filter((item) => item.packageIdentifiers.length || item.packagePrefixes?.length).every((item) => item.capabilities.includes('versionAware'))).toBe(true);
    expect(DISCOVERY_PROVIDERS.every((item) => item.packageIdentifiers.length + (item.packagePrefixes?.length ?? 0) + item.apiDomains.length + item.environmentVariables.length > 0)).toBe(true);
    expect(PROVIDER_CATALOG_SUMMARY).toHaveLength(DISCOVERY_PROVIDERS.length);
  });

  it('compiles exact package, prefix, environment, and domain indexes', () => {
    expect(DISCOVERY_PROVIDER_REGISTRY.exactPackageIndex.get('openai')?.map((item) => item.id)).toEqual(['openai']);
    expect(DISCOVERY_PROVIDER_REGISTRY.exactPackageIndex.get('@anthropic-ai/sdk')?.map((item) => item.id)).toEqual(['anthropic']);
    expect(DISCOVERY_PROVIDER_REGISTRY.packagePrefixIndex.lookup('@aws-sdk/client-s3').map((item) => item.id)).toEqual(['aws']);
    expect(DISCOVERY_PROVIDER_REGISTRY.environmentVariableIndex.get('OPENAI_API_KEY')?.map((item) => item.id)).toEqual(['openai']);
    expect(DISCOVERY_PROVIDER_REGISTRY.domainIndex.lookup('api.openai.com').map((item) => item.id)).toEqual(['openai']);
  });

  it('supports exact and valid suffix domains while rejecting malicious suffixes', () => {
    expect(DISCOVERY_PROVIDER_REGISTRY.domainIndex.lookup('api.anthropic.com').map((item) => item.id)).toEqual(['anthropic']);
    expect(DISCOVERY_PROVIDER_REGISTRY.domainIndex.lookup('project.supabase.co').map((item) => item.id)).toEqual(['supabase']);
    expect(DISCOVERY_PROVIDER_REGISTRY.domainIndex.lookup('evil-api.openai.com.example.com')).toEqual([]);
  });

  it('allows explicitly shared identifiers and preserves stable ordering', () => {
    const first = { id: 'alpha', displayName: 'Alpha', category: 'AI / Models' as const, packageIdentifiers: ['shared-sdk'], apiDomains: ['alpha.example.com'], environmentVariables: ['ALPHA_KEY'], documentation: { url: 'https://alpha.example.com' }, capability: 'discovery' as const, capabilities: ['discovery', 'versionAware'] as const, allowSharedIdentifiers: true };
    const second = { ...first, id: 'beta', displayName: 'Beta', apiDomains: ['beta.example.com'], environmentVariables: ['BETA_KEY'] };
    const registry = compileProviderRegistry([second, first]);
    expect(registry.exactPackageIndex.get('shared-sdk')?.map((item) => item.id)).toEqual(['alpha', 'beta']);
    expect(registry.definitions.map((item) => item.id)).toEqual(['alpha', 'beta']);
  });

  it('rejects duplicate, malformed, empty, and ambiguous registry definitions', () => {
    const base = { id: 'valid', displayName: 'Valid', category: 'AI / Models' as const, packageIdentifiers: ['valid-sdk'], apiDomains: ['valid.example.com'], environmentVariables: ['VALID_KEY'], documentation: { url: 'https://valid.example.com' }, capability: 'discovery' as const, capabilities: ['discovery', 'versionAware'] as const };
    expect(() => validateProviderDefinitions([base, { ...base }])).toThrow('INVALID_PROVIDER_ID');
    expect(() => validateProviderDefinitions([{ ...base, id: 'bad id' }])).toThrow('INVALID_PROVIDER_ID');
    expect(() => validateProviderDefinitions([{ ...base, packageIdentifiers: [''] }])).toThrow('INVALID_PROVIDER_PACKAGE');
    expect(() => validateProviderDefinitions([{ ...base, packagePrefixes: ['@aws-sdk/client-*oops'] }])).toThrow('INVALID_PROVIDER_PREFIX');
    expect(() => validateProviderDefinitions([{ ...base, apiDomains: ['https://valid.example.com/path'] }])).toThrow('INVALID_PROVIDER_DOMAIN');
    expect(() => validateProviderDefinitions([{ ...base, packageIdentifiers: ['@scope/'] }])).toThrow('INVALID_PROVIDER_PACKAGE');
    expect(() => validateProviderDefinitions([{ ...base, packagePrefixes: ['valid-'] }, { ...base, id: 'other', packageIdentifiers: ['valid-tool'], apiDomains: ['other.example.com'], environmentVariables: ['OTHER_KEY'] }])).toThrow('AMBIGUOUS_PROVIDER_PACKAGE');
  });

  it.each(DISCOVERY_PROVIDERS)('detects $displayName from its registered package', (definition) => {
    const packageName = definition.packageIdentifiers[0];
    const files = packageName
      ? { 'package.json': JSON.stringify({ dependencies: { [packageName]: '1.0.0' } }) }
      : definition.environmentVariables[0]
        ? { 'src/provider.ts': `const key = process.env.${definition.environmentVariables[0]};` }
        : { 'src/provider.ts': `fetch('https://${(definition.apiDomains[0] ?? '').replace(/^\*\./, 'api.')}');` };
    const results = scan(files);
    expect(results.map((item) => item.providerId)).toEqual([definition.id]);
  });

  it('detects declared packages and exact versions without inventing a version from ranges', () => {
    const results = scan({ 'package.json': JSON.stringify({ dependencies: { openai: '4.0.0', '@anthropic-ai/sdk': '^0.30.0', '@aws-sdk/client-bedrock-runtime': '3.3.0' }, devDependencies: { '@slack/web-api': '7.0.0' } }) });
    expect(results.map((item) => item.providerId)).toEqual(['anthropic', 'aws', 'openai', 'slack']);
    expect(results.find((item) => item.providerId === 'openai')?.detectedVersion).toBe('4.0.0');
    expect(results.find((item) => item.providerId === 'anthropic')?.detectedVersion).toBeNull();
    expect(results.find((item) => item.providerId === 'aws')?.packageName).toBe('@aws-sdk/client-bedrock-runtime');
  });

  it('resolves pnpm importer versions before package.json ranges', () => {
    const files = new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' }, devDependencies: { '@anthropic-ai/sdk': '^0.30.0' } })],
      ['pnpm-lock.yaml', `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      openai:\n        specifier: ^4.0.0\n        version: 4.2.0\n    devDependencies:\n      '@anthropic-ai/sdk':\n        specifier: ^0.30.0\n        version: 0.31.0\n`],
    ]);
    const versions = resolvePackageVersions(files);
    expect(versions.get('package.json\u0000openai')).toMatchObject({ declaredVersion: '^4.0.0', resolvedVersion: '4.2.0', versionSource: 'pnpm-lock', versionConfidence: 'exact' });
    expect(versions.get('package.json\u0000@anthropic-ai/sdk')).toMatchObject({ resolvedVersion: '0.31.0' });
    expect(discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY).find((item) => item.providerId === 'openai')).toMatchObject({ declaredVersion: '^4.0.0', resolvedVersion: '4.2.0', versionSource: 'pnpm-lock', versionConfidence: 'exact' });
  });

  it('resolves npm package-lock v3 package entries, including scoped packages', () => {
    const files = new Map([
      ['package.json', JSON.stringify({ dependencies: { '@anthropic-ai/sdk': '^0.30.0', openai: '^4.0.0' } })],
      ['package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { '@anthropic-ai/sdk': '^0.30.0' } }, 'node_modules/@anthropic-ai/sdk': { version: '0.30.4' }, 'node_modules/openai': { version: '4.1.0' } } })],
    ]);
    expect(resolvePackageVersions(files).get('package.json\u0000@anthropic-ai/sdk')).toMatchObject({ resolvedVersion: '0.30.4', versionSource: 'package-lock', versionConfidence: 'exact' });
    expect(discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY).find((item) => item.providerId === 'openai')).toMatchObject({ resolvedVersion: '4.1.0' });
  });

  it('resolves classic Yarn lock selectors', () => {
    const files = new Map([
      ['package.json', JSON.stringify({ dependencies: { '@slack/web-api': '^7.0.0' } })],
      ['yarn.lock', `"@slack/web-api@^7.0.0":\n  version "7.8.0"\n  resolved "https://registry.yarnpkg.com/@slack/web-api/-/web-api-7.8.0.tgz"\n`],
    ]);
    expect(discoverProviders(files, DISCOVERY_PROVIDER_REGISTRY).find((item) => item.providerId === 'slack')).toMatchObject({ resolvedVersion: '7.8.0', versionSource: 'yarn-lock', versionConfidence: 'exact' });
  });

  it('falls back honestly to package.json-only declared versions', () => {
    const result = discoverProviders(new Map([['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' } })]]), DISCOVERY_PROVIDER_REGISTRY).find((item) => item.providerId === 'openai');
    expect(result).toMatchObject({ declaredVersion: '^4.0.0', resolvedVersion: null, versionSource: 'package-json', versionConfidence: 'declared-only' });
  });

  it('preserves a conflicting declared range and exact lockfile resolution', () => {
    const result = discoverProviders(new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '^1.0.0' } })],
      ['package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/openai': { version: '2.0.0' } } })],
    ]), DISCOVERY_PROVIDER_REGISTRY).find((item) => item.providerId === 'openai');
    expect(result).toMatchObject({ declaredVersion: '^1.0.0', resolvedVersion: '2.0.0', versionConfidence: 'exact' });
  });

  it('falls back safely when lockfiles are malformed', () => {
    const result = discoverProviders(new Map([
      ['package.json', JSON.stringify({ dependencies: { openai: '^4.0.0' } })],
      ['pnpm-lock.yaml', 'lockfileVersion: [broken'],
      ['package-lock.json', '{broken'],
      ['yarn.lock', 'openai@^4.0.0:\n  version [broken'],
    ]), DISCOVERY_PROVIDER_REGISTRY).find((item) => item.providerId === 'openai');
    expect(result).toMatchObject({ declaredVersion: '^4.0.0', resolvedVersion: null, versionSource: 'package-json', versionConfidence: 'declared-only' });
  });

  it('points manifest evidence at the dependency key', () => {
    const results = scan({ 'package.json': '{\n  "dependencies": {\n    "openai": "4.0.0"\n  }\n}' });
    expect(results[0]?.locations).toEqual([{ file: 'package.json', line: 3, column: 5 }]);
  });

  it('detects imports and require without package-name lookalikes', () => {
    const results = scan({ 'src/client.ts': `import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { WebClient } from '@slack/web-api';
const firebase = require('firebase/app');
import unrelated from 'openai-helper';` });
    expect(results.map((item) => item.providerId)).toEqual(['anthropic', 'firebase', 'openai', 'slack']);
    expect(results.find((item) => item.providerId === 'firebase')?.detectionKind).toEqual(['require']);
    expect(results.find((item) => item.providerId === 'openai')?.evidence[0]?.line).toBe(1);
  });

  it('detects static fetch and axios domains, never unrelated or deceptive hosts', () => {
    const results = scan({ 'src/http.js': `fetch('https://api.anthropic.com/v1/messages');
axios.post('https://slack.com/api/chat.postMessage');
fetch('https://api.anthropic.com.evil.test/v1/messages');
fetch('https://not-slack.com/api');
fetch(userSuppliedUrl);` });
    expect(results.map((item) => item.providerId)).toEqual(['anthropic', 'slack']);
    expect(results[0]?.evidence[0]?.identifier).toBe('api.anthropic.com');
    expect(JSON.stringify(results)).not.toContain('v1/messages');
  });

  it('matches provider subdomains without treating the Supabase website as an API host', () => {
    const results = scan({ 'src/http.ts': `fetch('https://supabase.co/docs');
fetch('https://project.supabase.co/rest/v1/items');` });
    expect(results).toHaveLength(1);
    expect(results[0]?.apiDomains).toEqual(['project.supabase.co']);
  });

  it('combines multiple evidence types into one provider inventory entry', () => {
    const results = scan({
      'package.json': JSON.stringify({ dependencies: { '@anthropic-ai/sdk': '0.30.0' } }),
      'src/client.ts': `import Anthropic from '@anthropic-ai/sdk';
const key = process.env.ANTHROPIC_API_KEY;
fetch('https://api.anthropic.com/v1/messages');`,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ providerId: 'anthropic', packageName: '@anthropic-ai/sdk', detectedVersion: '0.30.0', capability: 'discovery' });
    expect(results[0]?.detectionKind).toEqual(['package', 'import', 'environment-variable', 'http-url']);
    expect(results[0]?.evidence).toHaveLength(4);
  });

  it('retains compatibility evidence when persisting discovery', () => {
    const compatibility = { schemaVersion: 1 as const, providers: [{ provider: 'stripe' as const, detected: false, usageCount: 0, mappedSymbolCount: 0 }] };
    const saved = scanResultWithDiscovery(compatibility, scan({ 'src/client.ts': "import OpenAI from 'openai';" }));
    expect(saved.providers).toEqual(compatibility.providers);
    expect(saved.discovery.providers).toHaveLength(1);
    expect(saved.discovery.providers[0]?.providerId).toBe('openai');
  });

  it('persists normalized usage IR separately from legacy compatibility evidence', () => {
    const compatibility = { schemaVersion: 1 as const, providers: [] };
    const usageIR = [{ id: 'usage-2', language: 'typescript' as const, providerId: 'openai', packageName: 'openai', declaredVersion: '^4.0.0', resolvedVersion: '4.2.0', versionSource: 'lockfile' as const, versionConfidence: 'exact' as const, operation: 'responses.create', parameters: [], responseFields: [], authEvidence: [], dynamic: false, location: { file: 'src/ai.ts', line: 4, column: 1 }, confidence: 0.95, evidence: [{ kind: 'sdk-call' as const, detail: 'responses.create', file: 'src/ai.ts', line: 4, provenance: 'static-source' as const }] }];
    const saved = scanResultWithDiscovery(compatibility, [], usageIR);
    expect(saved.usageIR).toEqual(usageIR);
    expect(saved.usageIRTruncated).toBe(false);
    expect(saved.providers).toEqual([]);
  });
});
