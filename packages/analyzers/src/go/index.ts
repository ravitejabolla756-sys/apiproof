import semver from 'semver';
import type { RepositoryAnalyzer, ProviderDescriptor } from '@apiproof/core';
import type { DependencyFinding, ScanResult, UsageFinding } from '@apiproof/shared';
import { TOOL_VERSION } from '@apiproof/shared';
import { normalizeCompatibilityUsage, usageFindingToCompatibilityUsage } from '../typescript/usage-ir.js';
import { GoRepositorySnapshot } from './repository.js';

export interface GoProviderDescriptor extends ProviderDescriptor {
  readonly packageNames?: readonly string[];
  readonly apiDomains?: readonly string[];
  readonly environmentVariables?: readonly string[];
}

const exactVersion = (value: string | undefined): string | null => value && semver.valid(value.replace(/^v/, '')) ? value.replace(/^v/, '') : null;
const packageNames = (provider: GoProviderDescriptor): string[] => [...new Set([provider.packageName, ...(provider.packageNames ?? [])])];
const packageMatches = (moduleName: string, provider: GoProviderDescriptor): string | undefined => packageNames(provider).find((name) => moduleName === name || moduleName.startsWith(`${name}/`));
const lineNumber = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;
const location = (file: string, content: string, offset: number, symbol: string) => { const line = lineNumber(content, offset); return { file, start: { line, column: offset - content.lastIndexOf('\n', offset - 1) }, end: { line, column: offset - content.lastIndexOf('\n', offset - 1) + Math.max(1, symbol.length) } }; };

function dependencies(snapshot: GoRepositorySnapshot, provider: GoProviderDescriptor): DependencyFinding[] {
  const goMod = snapshot.read('go.mod') ?? '';
  const goSum = snapshot.read('go.sum') ?? '';
  const modules = packageNames(provider);
  const declared = new Map<string, string>();
  for (const match of goMod.matchAll(/^\s*([\w./-]+)\s+(v[^\s]+)(?:\s+\/\/.*)?$/gm)) {
    const moduleName = match[1];
    const version = match[2];
    if (moduleName && version && modules.some((module) => moduleName === module || moduleName.startsWith(`${module}/`))) declared.set(moduleName, version);
  }
  const locked = new Map<string, string>();
  for (const match of goSum.matchAll(/^([\w./-]+)\s+(v[^\s/]+)\s+[^\s]+$/gm)) {
    const moduleName = match[1];
    const normalized = exactVersion(match[2]);
    if (moduleName && normalized && modules.some((module) => moduleName === module || moduleName.startsWith(`${module}/`))) locked.set(moduleName, normalized);
  }
  return [...new Set([...declared.keys(), ...locked.keys()])].sort().map((moduleName) => {
    const resolvedVersion = locked.get(moduleName) ?? exactVersion(declared.get(moduleName));
    return {
      manifest: 'go.mod', packageName: moduleName, declarations: [{ section: 'require', range: declared.get(moduleName) ?? resolvedVersion ?? 'unknown' }],
      installedVersion: null, lockedVersion: locked.get(moduleName) ?? null, lockfile: locked.has(moduleName) ? 'go.sum' : null,
      versionResolution: { version: resolvedVersion, source: locked.has(moduleName) ? 'lockfile' : resolvedVersion ? 'declared-exact' : 'unknown', certainty: locked.has(moduleName) ? 'locked' : resolvedVersion ? 'declared' : 'unknown' },
    } satisfies DependencyFinding;
  });
}

function addUsage(usages: UsageFinding[], file: string, content: string, offset: number, provider: GoProviderDescriptor, symbol: string, kind: UsageFinding['kind'], semantics: UsageFinding['semantics'] = 'invocation'): void {
  const loc = location(file, content, offset, symbol);
  usages.push({ id: `${file}:${loc.start.line}:${symbol}`, provider: provider.id, kind, semantics, symbol, location: loc, context: { function: null, class: null }, evidence: { binding: loc, basis: 'import-binding' }, confidence: kind === 'method' ? 0.9 : 0.98 });
}

function detectUsages(snapshot: GoRepositorySnapshot, provider: GoProviderDescriptor): UsageFinding[] {
  const usages: UsageFinding[] = [];
  const aliases = new Set<string>();
  for (const [file, content] of snapshot.sourceFiles()) {
    for (const match of content.matchAll(/^\s*(?:(\w+)\s+)?"([\w./-]+)"\s*$/gm)) {
      const imported = match[2];
      if (!imported || !packageMatches(imported, provider)) continue;
      const alias = match[1] ?? imported.split('/').at(-1);
      if (!alias) continue;
      aliases.add(alias);
      addUsage(usages, file, content, match.index ?? 0, provider, `import.${imported}`, 'import', 'method-reference');
    }
    const blockStart = content.match(/\bimport\s*\(/)?.index;
    if (blockStart !== undefined) {
      const block = content.slice(blockStart);
      for (const match of block.matchAll(/(?:^|\n)\s*(?:(\w+)\s+)?"([\w./-]+)"/g)) {
        const imported = match[2];
        if (!imported || !packageMatches(imported, provider)) continue;
        const alias = match[1] ?? imported.split('/').at(-1);
        if (!alias) continue;
        aliases.add(alias);
        addUsage(usages, file, content, blockStart + (match.index ?? 0), provider, `import.${imported}`, 'import', 'method-reference');
      }
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
      for (const match of content.matchAll(new RegExp(`(?:os\\.(?:Getenv|LookupEnv)|Getenv|LookupEnv)\\s*\\(\\s*["']${env}["']`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, env, 'resource', 'property-access');
    }
  }
  return usages;
}

export class GoRepositoryAnalyzer implements RepositoryAnalyzer {
  readonly language = 'go' as const;

  async analyze(repositoryPath: string | GoRepositorySnapshot | Map<string, string> | Record<string, string>, providerInput: ProviderDescriptor): Promise<ScanResult> {
    const provider = providerInput as GoProviderDescriptor;
    const snapshot = repositoryPath instanceof GoRepositorySnapshot ? repositoryPath : GoRepositorySnapshot.fromMemory(typeof repositoryPath === 'string' ? new Map() : repositoryPath instanceof Map ? repositoryPath : repositoryPath);
    const deps = dependencies(snapshot, provider);
    const usages = detectUsages(snapshot, provider);
    const dependency = deps[0];
    const declaredVersion = dependency?.declarations[0]?.range ?? null;
    const resolvedVersion = dependency?.versionResolution?.version ?? null;
    const versionSource = dependency?.versionResolution?.source ?? 'unknown';
    const versionConfidence = resolvedVersion ? 'exact' : declaredVersion ? 'declared-only' : 'unknown';
    const usageIR = usages.map((item) => normalizeCompatibilityUsage(usageFindingToCompatibilityUsage(item, dependency?.packageName ?? provider.packageName), { language: 'go', declaredVersion, resolvedVersion, versionSource, versionConfidence }));
    return { schemaVersion: '1.2', provider: provider.id, language: 'go', providerUsed: deps.length > 0 || usages.length > 0, dependencies: deps, usages, usageIR, diagnostics: snapshot.diagnostics, coverage: { scope: 'supported-static-patterns', filesAnalyzed: snapshot.sourceFiles().length, filesSkipped: 0, complete: snapshot.diagnostics.length === 0, limitations: ['Static Go source matching only; no go/packages loading, type checking, build execution, or dynamic dataflow.', 'Supported dependency evidence is go.mod and go.sum.'] }, audit: { toolVersion: TOOL_VERSION, inputDigest: snapshot.digest(), mode: 'static-read-only' } };
  }
}
