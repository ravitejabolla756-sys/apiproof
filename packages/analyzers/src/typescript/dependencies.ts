import path from 'node:path';
import semver from 'semver';
import { parseDocument } from 'yaml';
import { AnalysisError } from '@apiproof/shared';
import type { DependencyFinding } from '@apiproof/shared';
import type { RepositorySnapshot } from './repository.js';

type Dictionary = Record<string, unknown>;
function object(value: unknown): Dictionary {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Dictionary : {};
}
function exactVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // pnpm records peer resolution suffixes after the actual package version.
  return semver.valid(value.split('(')[0]);
}
function json(text: string | undefined, snapshot: RepositorySnapshot, file: string): Dictionary | undefined {
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Dictionary;
  } catch {
    if (file === 'package.json') throw new AnalysisError('INVALID_MANIFEST', 'Root package.json is not a valid JSON object.');
    snapshot.warn('INVALID_METADATA', 'Metadata is not a valid JSON object.', file);
    return undefined;
  }
}

interface Lock { file: string; directory: string; data: Dictionary; type: 'npm' | 'pnpm' }

async function readLocks(snapshot: RepositorySnapshot): Promise<Lock[]> {
  const locks: Lock[] = [];
  for (const manifest of snapshot.manifests) {
    const directory = path.posix.dirname(manifest);
    for (const name of ['package-lock.json', 'pnpm-lock.yaml']) {
      const file = path.posix.join(directory, name);
      const text = await snapshot.read(file);
      if (!text) continue;
      if (name === 'package-lock.json') {
        const data = json(text, snapshot, file);
        if (data) {
          if (![1, 2, 3].includes(Number(data.lockfileVersion))) snapshot.warn('UNSUPPORTED_LOCKFILE', 'Unsupported npm lockfile format.', file);
          else locks.push({ file, directory, data, type: 'npm' });
        }
      } else {
        try {
          const document = parseDocument(text, { uniqueKeys: true });
          if (document.errors.length) throw new Error();
          const data = object(document.toJS({ maxAliasCount: 50 }));
          if (![6, 9].includes(Number(data.lockfileVersion))) snapshot.warn('UNSUPPORTED_LOCKFILE', 'Supported pnpm lockfile versions are 6 and 9.', file);
          else locks.push({ file, directory, data, type: 'pnpm' });
        } catch { snapshot.warn('INVALID_LOCKFILE', 'pnpm lockfile could not be parsed safely.', file); }
      }
    }
  }
  return locks;
}

function lockVersion(lock: Lock, directory: string, packageName: string): string | null {
  const relative = path.posix.relative(lock.directory, directory) || '.';
  if (relative.startsWith('..')) return null;
  if (lock.type === 'npm') {
    const packages = object(lock.data.packages);
    let current = relative === '.' ? '' : relative;
    for (;;) {
      const version = exactVersion(object(packages[path.posix.join(current, 'node_modules', packageName)]).version);
      if (version) return version;
      if (!current) break;
      const parent = path.posix.dirname(current);
      current = parent === '.' ? '' : parent;
    }
    return relative === '.' ? exactVersion(object(object(lock.data.dependencies)[packageName]).version) : null;
  }
  const importers = object(lock.data.importers);
  const importer = object(importers[relative] ?? (relative === '.' ? lock.data : undefined));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const entry = object(importer[section])[packageName];
    const version = exactVersion(typeof entry === 'string' ? entry : object(entry).version);
    if (version) return version;
  }
  return null;
}

export async function detectDependencies(snapshot: RepositorySnapshot, packageName: string): Promise<DependencyFinding[]> {
  const locks = await readLocks(snapshot);
  const results: DependencyFinding[] = [];
  const installedCache = new Map<string, string | null>();
  for (const manifest of snapshot.manifests) {
    const data = json(await snapshot.read(manifest), snapshot, manifest);
    if (!data) continue;
    const directory = path.posix.dirname(manifest);
    const declarations: DependencyFinding['declarations'] = [];
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const range = object(data[section])[packageName];
      if (typeof range === 'string') declarations.push({ section, range });
    }
    let current = directory;
    let installedVersion: string | null;
    for (;;) {
      const file = path.posix.join(current, 'node_modules', packageName, 'package.json');
      if (!installedCache.has(file)) {
        const installed = json(await snapshot.read(file), snapshot, file);
        installedCache.set(file, installed?.name === packageName ? exactVersion(installed.version) : null);
      }
      installedVersion = installedCache.get(file) ?? null;
      if (installedVersion || current === '.') break;
      current = path.posix.dirname(current);
    }
    const applicable = locks.filter((lock) => lock.directory === '.' || directory === lock.directory || directory.startsWith(`${lock.directory}/`));
    const nearest = applicable.sort((a, b) => b.directory.length - a.directory.length)[0]?.directory;
    const versions = applicable.filter((lock) => lock.directory === nearest)
      .map((lock) => ({ file: lock.file, version: lockVersion(lock, directory, packageName) }))
      .filter((entry) => entry.version !== null);
    const conflict = new Set(versions.map((entry) => entry.version)).size > 1;
    if (conflict) snapshot.warn('LOCKFILE_CONFLICT', 'npm and pnpm lockfiles disagree on the package version.', manifest);
    const lockedVersion = conflict ? null : versions[0]?.version ?? null;
    const exactDeclarations = declarations.map((item) => semver.valid(item.range));
    const declaredExact = declarations.length > 0 && exactDeclarations.every((item) => item !== null) && new Set(exactDeclarations).size === 1
      ? exactDeclarations[0] ?? null : null;
    const version = installedVersion ?? lockedVersion ?? (conflict ? null : declaredExact);
    const source = installedVersion ? 'installed' : lockedVersion ? 'lockfile' : version ? 'declared-exact' : 'unknown';
    if (installedVersion && lockedVersion && installedVersion !== lockedVersion) {
      snapshot.warn('VERSION_DRIFT', 'Installed package and lockfile disagree; installed version takes precedence.', manifest);
    }
    if (declarations.length || installedVersion || lockedVersion) results.push({
      manifest, packageName, declarations, installedVersion, lockedVersion,
      lockfile: conflict ? null : versions[0]?.file ?? null,
      versionResolution: { version, source, certainty: source === 'installed' ? 'observed' : source === 'lockfile' ? 'locked' : source === 'declared-exact' ? 'declared' : 'unknown' },
    });
  }
  return results;
}
