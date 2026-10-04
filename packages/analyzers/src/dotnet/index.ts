import { createHash } from 'node:crypto';
import semver from 'semver';
import type { ProviderDescriptor, RepositoryAnalyzer } from '@apiproof/core';
import type { DependencyFinding, ScanResult, UsageFinding } from '@apiproof/shared';
import { TOOL_VERSION } from '@apiproof/shared';
import { normalizeCompatibilityUsage, usageFindingToCompatibilityUsage } from '../typescript/usage-ir.js';

export interface DotnetProviderDescriptor extends ProviderDescriptor {
  readonly packageNames?: readonly string[];
  readonly namespaceNames?: readonly string[];
  readonly apiDomains?: readonly string[];
  readonly environmentVariables?: readonly string[];
}

const packageNames = (provider: DotnetProviderDescriptor): string[] => [...new Set([provider.packageName, ...(provider.packageNames ?? [])])];
const namespaceNames = (provider: DotnetProviderDescriptor): string[] => [...new Set([provider.packageName, ...(provider.namespaceNames ?? [])])];
const matchesPackage = (value: string, provider: DotnetProviderDescriptor): boolean => packageNames(provider).some((name) => value === name || value.startsWith(`${name}.`));
const exactVersion = (value: string | undefined): string | null => value && semver.valid(value) ? value : null;

function filesFrom(input: string | Map<string, string> | Record<string, string>): ReadonlyMap<string, string> {
  if (typeof input === 'string') throw new Error('DOTNET_ANALYZER_REQUIRES_SNAPSHOT_OR_MEMORY_FILES');
  return input instanceof Map ? input : new Map(Object.entries(input));
}

function dependencies(files: ReadonlyMap<string, string>, provider: DotnetProviderDescriptor): DependencyFinding[] {
  const found = new Map<string, { manifest: string; range: string }>();
  for (const [file, content] of files) {
    if (!/\.(?:csproj|props|config)$/i.test(file)) continue;
    for (const match of content.matchAll(/<Package(?:Reference|Version)\s+Include\s*=\s*["']([^"']+)["'][^>]*Version\s*=\s*["']([^"']+)["']/gi)) {
      if (match[1] && matchesPackage(match[1], provider) && match[2]) found.set(match[1], { manifest: file, range: match[2] });
    }
  }
  return [...found].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([packageName, item]) => {
    const resolved = exactVersion(item.range);
    return { manifest: item.manifest, packageName, declarations: [{ section: 'PackageReference', range: item.range }], installedVersion: null, lockedVersion: null, lockfile: null, versionResolution: { version: resolved, source: resolved ? 'declared-exact' : 'unknown', certainty: resolved ? 'declared' : 'unknown' } } satisfies DependencyFinding;
  });
}

function addUsage(usages: UsageFinding[], file: string, content: string, offset: number, provider: DotnetProviderDescriptor, symbol: string, kind: UsageFinding['kind'], semantics: UsageFinding['semantics'] = 'invocation'): void {
  const line = content.slice(0, offset).split('\n').length;
  const column = offset - content.lastIndexOf('\n', offset - 1);
  const location = { file, start: { line, column }, end: { line, column: column + Math.max(1, symbol.length) } };
  usages.push({ id: `${file}:${line}:${symbol}`, provider: provider.id, kind, semantics, symbol, location, context: { function: null, class: null }, evidence: { binding: location, basis: 'import-binding' }, confidence: kind === 'method' ? 0.85 : 0.97 });
}

function detectUsages(files: ReadonlyMap<string, string>, provider: DotnetProviderDescriptor): UsageFinding[] {
  const usages: UsageFinding[] = [];
  const roots = new Set<string>();
  for (const [file, content] of files) {
    if (!/\.cs$/i.test(file)) continue;
    for (const match of content.matchAll(/^\s*using\s+(?:(\w+)\s*=\s*)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/gm)) {
      const imported = match[2];
      if (!imported || !namespaceNames(provider).some((name) => imported === name || imported.startsWith(`${name}.`))) continue;
      const root = match[1] ?? imported.split('.').at(-1);
      if (!root) continue;
      roots.add(root);
      addUsage(usages, file, content, match.index ?? 0, provider, `using.${imported}`, 'import', 'method-reference');
    }
    for (const constructorName of provider.constructorExports) roots.add(constructorName);
    for (const root of roots) {
      const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`\\b${escaped}\\.([A-Za-z_]\\w*)\\s*\\(`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, `${root}.${match[1]}`, 'method');
      for (const match of content.matchAll(new RegExp(`\\bnew\\s+${escaped}\\s*\\(`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, `new ${root}`, 'construction');
    }
    for (const domain of provider.apiDomains ?? []) {
      const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`https?://(?:[A-Za-z0-9-]+\\.)*${escaped}(?![A-Za-z0-9.-])(?:/[^"'\\s)]*)?`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, match[0], 'resource');
    }
    for (const env of provider.environmentVariables ?? []) {
      for (const match of content.matchAll(new RegExp(`Environment\\.GetEnvironmentVariable\\s*\\(\\s*["']${env}["']`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, env, 'resource', 'property-access');
      for (const match of content.matchAll(new RegExp(`Configuration\\s*\\[\\s*["']${env}["']`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, env, 'resource', 'property-access');
    }
  }
  return usages;
}

export class CSharpRepositoryAnalyzer implements RepositoryAnalyzer {
  readonly language = 'csharp' as const;

  async analyze(repositoryPath: string | Map<string, string> | Record<string, string>, providerInput: ProviderDescriptor): Promise<ScanResult> {
    const provider = providerInput as DotnetProviderDescriptor;
    const files = filesFrom(repositoryPath);
    const dependencyList = dependencies(files, provider);
    const usages = detectUsages(files, provider);
    const dependency = dependencyList[0];
    const declaredVersion = dependency?.declarations[0]?.range ?? null;
    const resolvedVersion = dependency?.versionResolution?.version ?? null;
    const versionSource = dependency?.versionResolution?.source ?? 'unknown';
    const versionConfidence = resolvedVersion ? 'exact' : declaredVersion ? 'declared-only' : 'unknown';
    const usageIR = usages.map((item) => normalizeCompatibilityUsage(usageFindingToCompatibilityUsage(item, dependency?.packageName ?? provider.packageName), { language: 'csharp', declaredVersion, resolvedVersion, versionSource, versionConfidence }));
    const inputDigest = createHash('sha256').update(JSON.stringify([...files].sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex');
    return { schemaVersion: '1.2', provider: provider.id, language: 'csharp', providerUsed: dependencyList.length > 0 || usages.length > 0, dependencies: dependencyList, usages, usageIR, diagnostics: [], coverage: { scope: 'supported-static-patterns', filesAnalyzed: [...files.keys()].filter((file) => /\.cs$/i.test(file)).length, filesSkipped: 0, complete: true, limitations: ['Text-based C# discovery only; no MSBuild/NuGet graph resolution, compiler/type information, or dynamic dataflow.', 'Supported dependency evidence is PackageReference, PackageVersion, and packages.config XML.'] }, audit: { toolVersion: TOOL_VERSION, inputDigest, mode: 'static-read-only' } };
  }
}
