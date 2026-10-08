import path from 'node:path';
import semver from 'semver';
import { Project, SyntaxKind, ts } from 'ts-morph';
import type { CallExpression, Node } from 'ts-morph';
import type { ProviderDefinition, ProviderCapability, ProviderRegistry } from '@apiproof/providers';
import { packageRoot, resolvePackageVersions } from './provider-versions.js';
import type { PackageVersionInfo, ProviderVersionConfidence, ProviderVersionSource } from './provider-versions.js';

export type ProviderDetectionKind = 'package' | 'import' | 'require' | 'http-url' | 'environment-variable';
export interface ProviderDiscoveryEvidence {
  detectionKind: ProviderDetectionKind;
  file: string;
  line: number;
  column: number;
  /** A package, host or variable name only; never source text or secret values. */
  identifier: string;
  packageName?: string;
  declaredVersion?: string | null;
  resolvedVersion?: string | null;
  versionSource?: ProviderVersionSource;
  versionConfidence?: ProviderVersionConfidence;
  detectedVersion?: string;
  apiDomain?: string;
}
export interface ProviderDiscoveryResult {
  providerId: string;
  providerName: string;
  packageName: string | null;
  declaredVersion: string | null;
  resolvedVersion: string | null;
  versionSource: ProviderVersionSource;
  versionConfidence: ProviderVersionConfidence;
  packageVersions: PackageVersionInfo[];
  detectedVersion: string | null;
  detectionKind: ProviderDetectionKind[];
  files: string[];
  locations: Array<{ file: string; line: number; column: number }>;
  evidence: ProviderDiscoveryEvidence[];
  apiDomains: string[];
  apiVersionHeaders: string[];
  capability: ProviderCapability;
  capabilities: ProviderCapability[];
  category: ProviderDefinition['category'];
}

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;
const MANIFEST = /(^|\/)package\.json$/;
const SECTIONS = ['dependencies', 'devDependencies'] as const;

function position(node: Node, file: string): Pick<ProviderDiscoveryEvidence, 'file' | 'line' | 'column'> {
  const point = node.getSourceFile().getLineAndColumnAtPos(node.getStart());
  return { file, line: point.line, column: point.column };
}

function manifestPosition(content: string, file: string, name: string, range: string): Pick<ProviderDiscoveryEvidence, 'file' | 'line' | 'column'> {
  const key = JSON.stringify(name);
  const value = JSON.stringify(range);
  let start = content.indexOf(key);
  while (start >= 0) {
    const afterKey = content.slice(start + key.length);
    if (new RegExp(`^\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(afterKey)) break;
    start = content.indexOf(key, start + key.length);
  }
  if (start < 0) return { file, line: 1, column: 1 };
  const preceding = content.slice(0, start);
  const line = preceding.split('\n').length;
  const lastNewline = preceding.lastIndexOf('\n');
  return { file, line, column: start - lastNewline };
}

function staticString(node: Node | undefined): string | null {
  return node && (node.isKind(SyntaxKind.StringLiteral) || node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral))
    ? node.getLiteralValue() : null;
}

function httpArgument(call: CallExpression): Node | undefined {
  const expression = call.getExpression().getText();
  if (expression === 'fetch' || expression === 'axios' || /^axios\.(?:get|post|put|patch|delete|head|request)$/.test(expression)) {
    return call.getArguments()[0];
  }
  return undefined;
}

/** Static discovery only: no runtime execution, secret values, or change-rule inference. */
export function discoverProviders(
  files: ReadonlyMap<string, string>, registry: ProviderRegistry,
): ProviderDiscoveryResult[] {
  const packageCandidates = (name: string): ProviderDefinition[] => {
    const names = name.startsWith('@') ? [name, name.split('/').slice(0, 2).join('/')] : [name, name.split('/')[0] ?? name];
    const candidates: ProviderDefinition[] = [];
    const seen = new Set<string>();
    for (const lookupName of names) {
      for (const definition of registry.exactPackageIndex.get(lookupName) ?? []) if (!seen.has(definition.id)) { seen.add(definition.id); candidates.push(definition); }
    }
    for (const definition of registry.packagePrefixIndex.lookup(name)) if (!seen.has(definition.id)) { seen.add(definition.id); candidates.push(definition); }
    return candidates;
  };
  const byId = new Map<string, { definition: ProviderDefinition; evidence: ProviderDiscoveryEvidence[] }>();
  const packageVersions = resolvePackageVersions(files);
  const versionsByPackage = new Map<string, PackageVersionInfo>();
  for (const version of packageVersions.values()) if (!versionsByPackage.has(version.packageName)) versionsByPackage.set(version.packageName, version);
  const add = (definition: ProviderDefinition, evidence: ProviderDiscoveryEvidence): void => {
    let entry = byId.get(definition.id);
    if (!entry) { entry = { definition, evidence: [] }; byId.set(definition.id, entry); }
    if (!entry.evidence.some((item) => item.file === evidence.file && item.line === evidence.line
      && item.column === evidence.column && item.detectionKind === evidence.detectionKind && item.identifier === evidence.identifier)) {
      entry.evidence.push(evidence);
    }
  };
  const versionFor = (definition: ProviderDefinition, name: string): PackageVersionInfo | undefined =>
    versionsByPackage.get(packageRoot(name, definition.packageIdentifiers, definition.packagePrefixes));
  const versionFields = (version: PackageVersionInfo | undefined, fallback?: string): Pick<ProviderDiscoveryEvidence, 'declaredVersion' | 'resolvedVersion' | 'versionSource' | 'versionConfidence'> => version
    ? { declaredVersion: version.declaredVersion, resolvedVersion: version.resolvedVersion, versionSource: version.versionSource, versionConfidence: version.versionConfidence }
    : { declaredVersion: fallback ?? null, resolvedVersion: null, versionSource: fallback ? 'package-json' : 'unknown', versionConfidence: fallback ? 'declared-only' : 'unknown' };

  const orderedFiles = [...files].sort(([a], [b]) => a.localeCompare(b, 'en'));
  for (const [file, content] of orderedFiles) {
    if (!MANIFEST.test(file) || file.split('/').includes('node_modules')) continue;
    let manifest: unknown;
    try { manifest = JSON.parse(content); } catch { continue; }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) continue;
    const record = manifest as Record<string, unknown>;
    for (const section of SECTIONS) {
      const dependencies = record[section];
      if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
      for (const [name, range] of Object.entries(dependencies)) {
        if (typeof range !== 'string') continue;
        for (const definition of packageCandidates(name)) {
          const version = versionFor(definition, name);
          add(definition, { detectionKind: 'package', ...manifestPosition(content, file, name, range), identifier: name,
            packageName: name, ...versionFields(version, range) });
        }
      }
    }
  }

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true, skipLoadingLibFiles: true,
    compilerOptions: { noLib: true, allowJs: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext, jsx: ts.JsxEmit.Preserve } });
  for (const [file, content] of orderedFiles) {
    if (!SOURCE_FILE.test(file) || file.split('/').some((part) => part === 'node_modules' || part.startsWith('.'))) continue;
    const source = project.createSourceFile(`/repository/${file.replaceAll('\\', '/')}`, content);
    const normalizedFile = path.posix.normalize(file.replaceAll('\\', '/'));
    const checkPackage = (name: string, kind: 'import' | 'require', node: Node): void => {
      for (const definition of packageCandidates(name)) {
        const packageName = packageRoot(name, definition.packageIdentifiers, definition.packagePrefixes);
        const version = versionsByPackage.get(packageName);
        add(definition, { detectionKind: kind, ...position(node, normalizedFile), identifier: name, packageName, ...versionFields(version) });
      }
    };
    for (const declaration of source.getImportDeclarations()) {
      checkPackage(declaration.getModuleSpecifierValue(), 'import', declaration);
    }
    source.forEachDescendant((node) => {
      if (node.isKind(SyntaxKind.CallExpression)) {
        const expression = node.getExpression().getText();
        if (expression === 'require') {
          const name = staticString(node.getArguments()[0]);
          if (name) checkPackage(name, 'require', node);
        }
        const argument = httpArgument(node);
        const literal = staticString(argument);
        if (literal) {
          let host: string;
          try {
            const url = new URL(literal);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
            host = url.hostname.toLowerCase();
          } catch { return; }
          for (const definition of registry.domainIndex.lookup(host)) add(definition, {
            detectionKind: 'http-url', ...position(argument!, normalizedFile), identifier: host, apiDomain: host,
          });
        }
      }
      if (node.isKind(SyntaxKind.PropertyAccessExpression)) {
        const expression = node.getExpression().getText();
        if (expression !== 'process.env' && expression !== 'import.meta.env') return;
        const identifier = node.getName();
        for (const definition of registry.environmentVariableIndex.get(identifier) ?? []) {
          add(definition, { detectionKind: 'environment-variable', ...position(node, normalizedFile), identifier });
        }
      }
    });
  }

  return [...byId.values()].sort((a, b) => a.definition.id.localeCompare(b.definition.id, 'en')).map(({ definition, evidence }) => {
    evidence.sort((a, b) => a.file.localeCompare(b.file, 'en') || a.line - b.line || a.column - b.column || a.detectionKind.localeCompare(b.detectionKind));
    const packageNames = [...new Set(evidence.flatMap((item) => item.packageName ? [item.packageName] : []))];
    const packageInfos = packageNames.map((name) => versionsByPackage.get(name)).filter((item): item is PackageVersionInfo => Boolean(item));
    const singleVersion = packageNames.length === 1 ? packageInfos[0] : undefined;
    const legacyVersion = singleVersion?.resolvedVersion ?? (singleVersion?.versionConfidence === 'declared-only' && semver.valid(singleVersion.declaredVersion ?? '') ? singleVersion.declaredVersion : null);
    return {
      providerId: definition.id, providerName: definition.displayName,
      packageName: packageNames.length === 1 ? packageNames[0] ?? null : null,
      declaredVersion: singleVersion?.declaredVersion ?? null,
      resolvedVersion: singleVersion?.resolvedVersion ?? null,
      versionSource: singleVersion?.versionSource ?? 'unknown',
      versionConfidence: singleVersion?.versionConfidence ?? 'unknown',
      packageVersions: packageInfos,
      detectedVersion: legacyVersion,
      detectionKind: [...new Set(evidence.map((item) => item.detectionKind))],
      files: [...new Set(evidence.map((item) => item.file))],
      locations: evidence.map(({ file, line, column }) => ({ file, line, column })),
      evidence, apiDomains: [...new Set(evidence.flatMap((item) => item.apiDomain ? [item.apiDomain] : []))], apiVersionHeaders: [...definition.apiVersionHeaders ?? []],
      capability: definition.capability,
      capabilities: [...definition.capabilities],
      category: definition.category,
    };
  });
}
