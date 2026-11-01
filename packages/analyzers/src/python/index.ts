import semver from 'semver';
import type { RepositoryAnalyzer, ProviderDescriptor } from '@apiproof/core';
import type { ArgumentFact, DependencyFinding, ScanResult, UsageFinding } from '@apiproof/shared';
import { literalHash, TOOL_VERSION } from '@apiproof/shared';
import { PythonRepositorySnapshot } from './repository.js';
import { normalizeCompatibilityUsage } from '../typescript/usage-ir.js';
import { usageFindingToCompatibilityUsage } from '../typescript/usage-ir.js';
import { extractExplicitApiVersion } from '../api-version.js';

export interface PythonProviderDescriptor extends ProviderDescriptor {
  readonly packageNames?: readonly string[];
  readonly apiDomains?: readonly string[];
  readonly environmentVariables?: readonly string[];
}

const lineNumber = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;
const location = (file: string, line: number, column: number, symbol: string) => ({ file, start: { line, column }, end: { line, column: column + Math.max(1, symbol.length) } });
const packageNames = (provider: PythonProviderDescriptor): string[] => [...new Set([provider.packageName, ...(provider.packageNames ?? [])])];
const packagePattern = (provider: PythonProviderDescriptor): string => packageNames(provider).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const exactVersion = (value: string | undefined): string | null => value && semver.valid(value) ? value : null;

function dependencyFor(snapshot: PythonRepositorySnapshot, provider: PythonProviderDescriptor): DependencyFinding[] {
  const names = new Set(packageNames(provider).map((name) => name.toLowerCase()));
  const declared = new Map<string, { manifest: string; range: string }>();
  for (const file of ['requirements.txt', 'requirements-dev.txt']) {
    const text = snapshot.read(file);
    if (!text) continue;
    for (const raw of text.split(/\r?\n/)) {
      const match = raw.trim().match(/^([A-Za-z0-9_.-]+)\s*(===|==|~=|>=|<=|>|<)\s*([^\s;]+)/);
      const packageName = match?.[1];
      const operator = match?.[2];
      const range = match?.[3];
      if (packageName && operator && range && names.has(packageName.toLowerCase())) declared.set(packageName.toLowerCase(), { manifest: file, range: `${operator}${range}` });
    }
  }
  for (const file of ['pyproject.toml']) {
    const text = snapshot.read(file) ?? '';
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = text.match(new RegExp(`(?:^|[\\"'])${escaped}(?:[\\"']?\\s*=\\s*[\\"']|[\\"']\\s*,\\s*[\\"'])}([^\\"']+)`, 'im'));
      if (match?.[1]) declared.set(name, { manifest: file, range: match[1].trim() });
    }
  }
  const lockVersions = new Map<string, string>();
  for (const file of ['poetry.lock', 'uv.lock']) {
    const text = snapshot.read(file) ?? '';
    const blocks = text.split(/(?=^\[\[package\]\])/m);
    for (const block of blocks) {
      const name = block.match(/^name\s*=\s*["']([^"']+)["']/m)?.[1]?.toLowerCase();
      const version = block.match(/^version\s*=\s*["']([^"']+)["']/m)?.[1];
      if (name && version && names.has(name) && exactVersion(version)) lockVersions.set(name, version);
    }
  }
  return [...new Set([...declared.keys(), ...lockVersions.keys()])].sort().map((name) => {
    const item = declared.get(name);
    const locked = lockVersions.get(name) ?? null;
    const exactDeclared = item ? semver.valid(item.range.replace(/^[^0-9]*/, '')) : null;
    return {
      manifest: item?.manifest ?? 'poetry.lock', packageName: name, declarations: item ? [{ section: 'dependencies', range: item.range }] : [],
      installedVersion: null, lockedVersion: locked, lockfile: locked ? (snapshot.read('poetry.lock') ? 'poetry.lock' : 'uv.lock') : null,
      versionResolution: { version: locked ?? exactDeclared, source: locked ? 'lockfile' : exactDeclared ? 'declared-exact' : 'unknown', certainty: locked ? 'locked' : exactDeclared ? 'declared' : 'unknown' },
    } satisfies DependencyFinding;
  });
}

function addUsage(usages: UsageFinding[], file: string, content: string, offset: number, provider: PythonProviderDescriptor, symbol: string, kind: UsageFinding['kind'], basis: 'import-binding' | 'require-binding' | 'type-annotation' = 'import-binding', semantics: UsageFinding['semantics'] = 'invocation', argumentFacts?: ArgumentFact[]): void {
  const line = lineNumber(content, offset);
  const loc = location(file, line, offset - content.lastIndexOf('\n', offset - 1), symbol);
  const apiVersion = extractExplicitApiVersion(content, offset);
  usages.push({ id: `${file}:${line}:${symbol}`, provider: provider.id, kind, semantics, symbol, location: loc, context: { function: null, class: null }, evidence: { binding: loc, basis }, confidence: kind === 'method' ? 0.9 : 0.98, ...(apiVersion ? { apiVersion } : {}), ...(argumentFacts ? { arguments: argumentFacts } : {}) });
}

function detectUsages(snapshot: PythonRepositorySnapshot, provider: PythonProviderDescriptor): UsageFinding[] {
  const usages: UsageFinding[] = [];
  const pattern = packagePattern(provider);
  const aliases = new Set<string>();
  for (const [file, content] of snapshot.sourceFiles()) {
    for (const match of content.matchAll(new RegExp(`\\bimport\\s+(${pattern})(?:\\.\\w+)?(?![A-Za-z0-9_-])(?:\\s+as\\s+(\\w+))?`, 'g'))) {
      const imported = match[1];
      const alias = match[2] ?? imported?.split('.')[0];
      if (!imported || !alias) continue;
      aliases.add(alias);
      addUsage(usages, file, content, match.index ?? 0, provider, `import.${imported}`, 'import', 'import-binding', 'method-reference');
    }
    for (const match of content.matchAll(new RegExp(`\\bfrom\\s+(${pattern})(?:\\.\\w+)*(?![A-Za-z0-9_-])\\s+import\\s+([A-Za-z_]\\w*)(?:\\s+as\\s+(\\w+))?`, 'g'))) {
      const imported = match[2];
      const alias = match[3] ?? imported;
      if (!imported || !alias) continue;
      aliases.add(alias);
      addUsage(usages, file, content, match.index ?? 0, provider, `import.${imported}`, 'import', 'import-binding', 'method-reference');
    }
    for (const alias of [...aliases]) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`\\b([A-Za-z_]\\w*)\\s*=\\s*${escapedAlias}\\s*\\(`, 'g'))) aliases.add(match[1]!);
    }
    for (const alias of [...aliases]) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`\\b([A-Za-z_]\\w*)\\s*=\\s*${escapedAlias}\\.[A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*\\s*\\(`, 'g'))) if (match[1]) aliases.add(match[1]);
    }
    for (const alias of aliases) {
      for (const match of content.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)\\s*\\(`, 'g'))) {
        const offset = match.index ?? 0;
        const lineEnd = content.indexOf('\n', offset) === -1 ? content.length : content.indexOf('\n', offset);
        const callText = content.slice(offset, lineEnd);
        const modelMatch = callText.match(/\bmodel\s*=\s*(["'])([^"']+)\1/);
        const model = modelMatch?.[2];
        const modelProperty = { path: 'model', location: location(file, lineNumber(content, offset), Math.max(1, offset - content.lastIndexOf('\n', offset - 1)), 'model'), ...(model ? { literalHash: literalHash(model) } : {}) };
        const facts: ArgumentFact[] = [{ index: 0, complete: Boolean(model), properties: [modelProperty] }];
        addUsage(usages, file, content, offset, provider, match[0].replace(/\s*\($/, ''), 'method', 'import-binding', 'invocation', facts);
      }
    }
    for (const domain of provider.apiDomains ?? []) {
      const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const match of content.matchAll(new RegExp(`https?://(?:[A-Za-z0-9-]+\\.)*${escaped}(?![A-Za-z0-9.-])(?:/[^"'\\s)]*)?`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, match[0], 'resource');
    }
    for (const env of provider.environmentVariables ?? []) {
      for (const match of content.matchAll(new RegExp(`(?:os\\.environ(?:\\.get)?|getenv)\\s*\\(\\s*["']${env}["']`, 'g'))) addUsage(usages, file, content, match.index ?? 0, provider, env, 'resource', 'import-binding', 'property-access');
    }
  }
  return usages;
}

export class PythonRepositoryAnalyzer implements RepositoryAnalyzer {
  readonly language = 'python' as const;

  async analyze(repositoryPath: string | PythonRepositorySnapshot | Map<string, string> | Record<string, string>, providerInput: ProviderDescriptor): Promise<ScanResult> {
    const provider = providerInput as PythonProviderDescriptor;
    const snapshot = repositoryPath instanceof PythonRepositorySnapshot ? repositoryPath : PythonRepositorySnapshot.fromMemory(typeof repositoryPath === 'string' ? new Map() : repositoryPath instanceof Map ? repositoryPath : repositoryPath);
    const dependencies = dependencyFor(snapshot, provider);
    const usages = detectUsages(snapshot, provider);
    const dependency = dependencies[0];
    const declaredVersion = dependency?.declarations[0]?.range ?? null;
    const resolvedVersion = dependency?.versionResolution?.version ?? null;
    const versionSource = dependency?.versionResolution?.source ?? 'unknown';
    const versionConfidence = resolvedVersion ? 'exact' : declaredVersion ? 'declared-only' : 'unknown';
    const usageIR = usages.map((item) => normalizeCompatibilityUsage(usageFindingToCompatibilityUsage(item, dependency?.packageName ?? provider.packageName), { language: 'python', declaredVersion, resolvedVersion, versionSource, versionConfidence }));
    return { schemaVersion: '1.2', provider: provider.id, language: 'python', providerUsed: dependencies.length > 0 || usages.length > 0, dependencies, usages, usageIR, diagnostics: snapshot.diagnostics, coverage: { scope: 'supported-static-patterns', filesAnalyzed: snapshot.sourceFiles().length, filesSkipped: 0, complete: snapshot.diagnostics.length === 0, limitations: ['Static Python syntax matching only; no interpreter execution, import graph resolution, or dynamic dataflow.', 'Supported dependency evidence is requirements.txt, pyproject.toml, poetry.lock, and uv.lock.'] }, audit: { toolVersion: TOOL_VERSION, inputDigest: snapshot.digest(), mode: 'static-read-only' } };
  }
}
