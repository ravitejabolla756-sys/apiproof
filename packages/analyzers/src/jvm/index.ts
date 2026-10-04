import { createHash } from 'node:crypto';
import semver from 'semver';
import type { RepositoryAnalyzer, ProviderDescriptor } from '@apiproof/core';
import type { DependencyFinding, ScanResult, UsageFinding } from '@apiproof/shared';
import { TOOL_VERSION } from '@apiproof/shared';
import { normalizeCompatibilityUsage, usageFindingToCompatibilityUsage } from '../typescript/usage-ir.js';

export interface JvmProviderDescriptor extends ProviderDescriptor {
  readonly packageNames?: readonly string[];
  readonly coordinates?: readonly string[];
  readonly apiDomains?: readonly string[];
  readonly environmentVariables?: readonly string[];
}

type JvmLanguage = 'java' | 'kotlin';
const packageNames = (provider: JvmProviderDescriptor): string[] => [...new Set([provider.packageName, ...(provider.packageNames ?? [])])];
const coordinateNames = (provider: JvmProviderDescriptor): string[] => [...new Set([provider.packageName, ...(provider.coordinates ?? [])])];
const matchesPackage = (value: string, provider: JvmProviderDescriptor): boolean => packageNames(provider).some((name) => value === name || value.startsWith(`${name}.`)) || coordinateNames(provider).some((name) => value === name || value.startsWith(`${name}:`));
const exactVersion = (value: string | undefined): string | null => value && semver.valid(value) ? value : null;

function filesFrom(input: string | Map<string, string> | Record<string, string>): ReadonlyMap<string, string> {
  if (typeof input === 'string') throw new Error('JVM_ANALYZER_REQUIRES_SNAPSHOT_OR_MEMORY_FILES');
  return input instanceof Map ? input : new Map(Object.entries(input));
}

function dependencies(files: ReadonlyMap<string, string>, provider: JvmProviderDescriptor): DependencyFinding[] {
  const found = new Map<string, { manifest: string; range: string }>();
  for (const [file, content] of files) {
    if (!/^(?:pom\.xml|build\.gradle(?:\.kts)?)$/.test(file)) continue;
    for (const match of content.matchAll(/<groupId>\s*([^<]+)\s*<\/groupId>[\s\S]*?<artifactId>\s*([^<]+)\s*<\/artifactId>[\s\S]*?<version>\s*([^<]+)\s*<\/version>/g)) {
      const coordinate = `${match[1]}:${match[2]}`;
      if (matchesPackage(coordinate, provider) && match[3]) found.set(coordinate, { manifest: file, range: match[3].trim() });
    }
    for (const match of content.matchAll(/(?:implementation|api|compileOnly|runtimeOnly)\s*\(?\s*["']([^"']+)["']/g)) {
      const coordinate = match[1];
      if (coordinate && matchesPackage(coordinate, provider)) {
        const parts = coordinate.split(':');
        found.set(parts.slice(0, 2).join(':'), { manifest: file, range: parts[2] ?? 'unknown' });
      }
    }
  }
  return [...found].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([packageName, item]) => {
    const resolved = exactVersion(item.range);
    return { manifest: item.manifest, packageName, declarations: [{ section: 'build-dependencies', range: item.range }], installedVersion: null, lockedVersion: null, lockfile: null, versionResolution: { version: resolved, source: resolved ? 'declared-exact' : 'unknown', certainty: resolved ? 'declared' : 'unknown' } } satisfies DependencyFinding;
  });
}

function addUsage(usages: UsageFinding[], file: string, content: string, offset: number, provider: JvmProviderDescriptor, symbol: string, kind: UsageFinding['kind'], semantics: UsageFinding['semantics'] = 'invocation'): void {
  const line = content.slice(0, offset).split('\n').length;
  const column = offset - content.lastIndexOf('\n', offset - 1);
  const location = { file, start: { line, column }, end: { line, column: column + Math.max(1, symbol.length) } };
  usages.push({ id: `${file}:${line}:${symbol}`, provider: provider.id, kind, semantics, symbol, location, context: { function: null, class: null }, evidence: { binding: location, basis: 'import-binding' }, confidence: kind === 'method' ? 0.85 : 0.97 });
}

function detectUsages(files: ReadonlyMap<string, string>, provider: JvmProviderDescriptor): UsageFinding[] {
  const usages: UsageFinding[] = [];
  const aliases = new Set<string>();
  for (const [file, content] of files) {
    if (!/\.(?:java|kt)$/i.test(file)) continue;
    for (const match of content.matchAll(/^\s*import\s+(?:(\w+)\s+)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/gm)) {
      const imported = match[2];
      if (!imported || !matchesPackage(imported, provider)) continue;
      const alias = match[1] ?? imported.split('.').at(-1);
      if (!alias) continue;
      aliases.add(alias);
      addUsage(usages, file, content, match.index ?? 0, provider, `import.${imported}`, 'import', 'method-reference');
    }
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`\\b${escaped}\\.([A-Za-z_]\\w*)\\s*\\(`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, `${alias}.${match[1]}`, 'method');
    }
    for (const domain of provider.apiDomains ?? []) {
      const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`https?://(?:[A-Za-z0-9-]+\\.)*${escaped}(?![A-Za-z0-9.-])(?:/[^"'\\s)]*)?`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, match[0], 'resource');
    }
    for (const env of provider.environmentVariables ?? []) {
      for (const match of content.matchAll(new RegExp(`(?:System\\.(?:getenv|getProperty))\\s*\\(\\s*["']${env}["']`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, env, 'resource', 'property-access');
    }
  }
  return usages;
}

export class JvmRepositoryAnalyzer implements RepositoryAnalyzer {
  constructor(readonly language: JvmLanguage) {}

  async analyze(repositoryPath: string | Map<string, string> | Record<string, string>, providerInput: ProviderDescriptor): Promise<ScanResult> {
    const provider = providerInput as JvmProviderDescriptor;
    const files = filesFrom(repositoryPath);
    const dependencyList = dependencies(files, provider);
    const usages = detectUsages(files, provider);
    const dependency = dependencyList[0];
    const declaredVersion = dependency?.declarations[0]?.range ?? null;
    const resolvedVersion = dependency?.versionResolution?.version ?? null;
    const versionSource = dependency?.versionResolution?.source ?? 'unknown';
    const versionConfidence = resolvedVersion ? 'exact' : declaredVersion ? 'declared-only' : 'unknown';
    const usageIR = usages.map((item) => normalizeCompatibilityUsage(usageFindingToCompatibilityUsage(item, dependency?.packageName ?? provider.packageName), { language: this.language, declaredVersion, resolvedVersion, versionSource, versionConfidence }));
    const inputDigest = createHash('sha256').update(JSON.stringify([...files].sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex');
    return { schemaVersion: '1.2', provider: provider.id, language: this.language, providerUsed: dependencyList.length > 0 || usages.length > 0, dependencies: dependencyList, usages, usageIR, diagnostics: [], coverage: { scope: 'supported-static-patterns', filesAnalyzed: [...files.keys()].filter((file) => /\.(?:java|kt)$/i.test(file)).length, filesSkipped: 0, complete: true, limitations: ['Text-based JVM discovery only; no Maven/Gradle model resolution, compiler/type information, or dynamic dataflow.', 'Java and Kotlin are dispatched through the same semantic adapter and normalized IR.'] }, audit: { toolVersion: TOOL_VERSION, inputDigest, mode: 'static-read-only' } };
  }
}

export class JavaRepositoryAnalyzer extends JvmRepositoryAnalyzer { constructor() { super('java'); } }
export class KotlinRepositoryAnalyzer extends JvmRepositoryAnalyzer { constructor() { super('kotlin'); } }
