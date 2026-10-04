import path from 'node:path';
import semver from 'semver';
import { parseDocument } from 'yaml';

export type ProviderVersionSource = 'pnpm-lock' | 'package-lock' | 'yarn-lock' | 'package-json' | 'unknown';
export type ProviderVersionConfidence = 'exact' | 'declared-only' | 'unknown';

export interface PackageVersionInfo {
  packageName: string;
  declaredVersion: string | null;
  resolvedVersion: string | null;
  versionSource: ProviderVersionSource;
  versionConfidence: ProviderVersionConfidence;
}

type RecordValue = Record<string, unknown>;
const DECLARATION_SECTIONS = ['dependencies', 'devDependencies'] as const;

function record(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function exact(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.split('(')[0]?.trim() ?? value;
  return semver.valid(candidate);
}

function parseJson(value: string | undefined): RecordValue | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as RecordValue : null;
  } catch { return null; }
}

function manifestDeclarations(files: ReadonlyMap<string, string>): Map<string, { manifest: string; declaredVersion: string }> {
  const declarations = new Map<string, { manifest: string; declaredVersion: string }>();
  for (const [file, content] of [...files].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    if (!/(^|\/)package\.json$/.test(file) || file.split('/').includes('node_modules')) continue;
    const manifest = parseJson(content);
    if (!manifest) continue;
    for (const section of DECLARATION_SECTIONS) {
      for (const [packageName, declaredVersion] of Object.entries(record(manifest[section]))) {
        if (typeof declaredVersion === 'string' && !declarations.has(`${file}\u0000${packageName}`)) {
          declarations.set(`${file}\u0000${packageName}`, { manifest: file, declaredVersion });
        }
      }
    }
  }
  return declarations;
}

function lockPath(manifest: string, name: string): string {
  return path.posix.join(path.posix.dirname(manifest), name);
}

function pnpmVersion(content: string, packageName: string, manifest: string): string | null {
  try {
    const parsed = parseDocument(content, { uniqueKeys: true });
    if (parsed.errors.length) return null;
    const root = record(parsed.toJS({ maxAliasCount: 50 }));
    const lockfileVersion = Number(root.lockfileVersion);
    if (Number.isFinite(lockfileVersion) && ![6, 9].includes(lockfileVersion)) return null;
    const importerPath = path.posix.relative('.', path.posix.dirname(manifest)) || '.';
    const importer = record(record(root.importers)[importerPath] ?? (importerPath === '.' ? root : undefined));
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const entry = record(importer[section])[packageName];
      const resolved = exact(typeof entry === 'string' ? entry : record(entry).version);
      if (resolved) return resolved;
    }
    return null;
  } catch { return null; }
}

function npmVersion(content: string, packageName: string, manifest: string): string | null {
  const root = parseJson(content);
  if (!root) return null;
  const lockfileVersion = Number(root.lockfileVersion);
  if (!Number.isFinite(lockfileVersion) || ![1, 2, 3].includes(lockfileVersion)) return null;
  const relative = path.posix.relative('.', path.posix.dirname(manifest)) || '';
  const packages = record(root.packages);
  let current = relative;
  for (;;) {
    const key = path.posix.join(current, 'node_modules', packageName);
    const resolved = exact(record(packages[key]).version);
    if (resolved) return resolved;
    if (!current) break;
    current = path.posix.dirname(current);
    if (current === '.') current = '';
  }
  return exact(record(record(root.dependencies)[packageName]).version);
}

function yarnVersion(content: string, packageName: string, declaredVersion: string): string | null {
  if (/^__metadata:\s*$/m.test(content)) return null;
  const lines = content.split(/\r?\n/);
  let selectors: string[] = [];
  let resolved: string | null = null;
  const finish = (): string | null => {
    const matches = selectors.some((selector) => selector === `${packageName}@${declaredVersion}` || selector.startsWith(`${packageName}@`));
    return matches ? resolved : null;
  };
  for (const line of [...lines, '']) {
    if (line.length > 0 && !/^\s/.test(line) && line.endsWith(':')) {
      const previous = finish();
      if (previous) return previous;
      const header = line.slice(0, -1).trim();
      selectors = header.split(/\s*,\s*/).map((item) => item.replaceAll('"', '').trim());
      resolved = null;
      continue;
    }
    const match = line.match(/^\s+version\s+["']([^"']+)["']/);
    if (match) resolved = exact(match[1]);
  }
  return finish();
}

function resolveOne(files: ReadonlyMap<string, string>, manifest: string, packageName: string, declaredVersion: string): PackageVersionInfo {
  const candidates: Array<{ source: ProviderVersionSource; version: string | null }> = [
    { source: 'pnpm-lock', version: pnpmVersion(files.get(lockPath(manifest, 'pnpm-lock.yaml')) ?? '', packageName, manifest) },
    { source: 'package-lock', version: npmVersion(files.get(lockPath(manifest, 'package-lock.json')) ?? '', packageName, manifest) },
    { source: 'yarn-lock', version: yarnVersion(files.get(lockPath(manifest, 'yarn.lock')) ?? '', packageName, declaredVersion) },
  ];
  const locked = candidates.find((candidate) => candidate.version !== null);
  if (locked?.version) return { packageName, declaredVersion, resolvedVersion: locked.version, versionSource: locked.source, versionConfidence: 'exact' };
  return { packageName, declaredVersion, resolvedVersion: null, versionSource: 'package-json', versionConfidence: 'declared-only' };
}

export function resolvePackageVersions(files: ReadonlyMap<string, string>): Map<string, PackageVersionInfo> {
  const results = new Map<string, PackageVersionInfo>();
  for (const declaration of manifestDeclarations(files).values()) {
    const parsed = parseJson(files.get(declaration.manifest));
    for (const section of DECLARATION_SECTIONS) {
      for (const [packageName, declaredVersion] of Object.entries(record(parsed?.[section]))) {
        if (typeof declaredVersion !== 'string') continue;
        results.set(`${declaration.manifest}\u0000${packageName}`, resolveOne(files, declaration.manifest, packageName, declaredVersion));
      }
    }
  }
  return results;
}

export function packageRoot(name: string, packageIdentifiers: readonly string[], packagePrefixes: readonly string[] = []): string {
  const identifier = [...packageIdentifiers].sort((a, b) => b.length - a.length).find((candidate) => name === candidate || name.startsWith(`${candidate}/`));
  if (identifier) return identifier;
  const prefix = packagePrefixes.find((candidate) => name.startsWith(candidate));
  return prefix ? name : name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0] ?? name;
}
