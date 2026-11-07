import { createHash } from 'node:crypto';
import { open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { AnalysisError, EXCLUDED_DIRECTORIES } from '@apiproof/shared';
import type { Diagnostic } from '@apiproof/shared';

export const LIMITS = { files: 5_000, entries: 50_000, depth: 64, fileBytes: 1_048_576, metadataBytes: 4_194_304, totalBytes: 33_554_432 } as const;
const sourceExtension = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

/** Audit digests bind canonical text, independent of the checkout line ending. */
function textDigest(value: string): string {
  return createHash('sha256').update(value.replace(/\r\n?/g, '\n')).digest('hex');
}

export function portable(value: string): string { return value.split(path.sep).join('/'); }
export function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** One bounded snapshot. Never loads tsconfig plugins, resolves dependencies, or invokes project scripts. */
export class RepositorySnapshot {
  readonly diagnostics: Diagnostic[] = [];
  readonly sources = new Map<string, string>();
  readonly manifests: string[] = [];
  readonly hashes = new Map<string, string>();
  skipped = 0;
  private entries = 0;
  private bytes = 0;

  private constructor(readonly root: string) {}

  static fromMemory(root: string, files: Map<string, string>): RepositorySnapshot {
    const snapshot = new RepositorySnapshot(root);
    for (const [relativePath, content] of files) {
      const norm = portable(relativePath);
      if (norm === 'package.json' || norm.endsWith('/package.json')) snapshot.manifests.push(norm);
      if (sourceExtension.test(norm)) {
        snapshot.sources.set(norm, content);
        snapshot.hashes.set(norm, textDigest(content));
      }
    }
    if (!snapshot.manifests.includes('package.json')) {
      snapshot.manifests.push('package.json');
    }
    return snapshot;
  }

  static async load(repositoryPath: string): Promise<RepositorySnapshot> {
    let root: string;
    try { root = await realpath(path.resolve(repositoryPath)); }
    catch { throw new AnalysisError('INVALID_REPOSITORY', 'Repository path does not exist or is not readable.'); }
    const snapshot = new RepositorySnapshot(root);
    await snapshot.walk(root, 0);
    if (!snapshot.manifests.includes('package.json')) {
      throw new AnalysisError('MISSING_MANIFEST', 'Repository must contain a readable root package.json.');
    }
    return snapshot;
  }

  warn(code: string, message: string, file?: string): void {
    this.diagnostics.push({ code, message, ...(file ? { file } : {}) });
  }

  async read(relative: string, limit: number = LIMITS.metadataBytes): Promise<string | undefined> {
    const requested = path.resolve(this.root, relative);
    if (!isInside(this.root, requested)) throw new AnalysisError('OUTSIDE_REPOSITORY', 'File path escapes repository boundary.');
    let actual: string;
    try { actual = await realpath(requested); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.warn('UNREADABLE_FILE', 'File could not be read.', relative);
      return undefined;
    }
    if (!isInside(this.root, actual)) {
      this.warn('EXTERNAL_SYMLINK', 'File resolves outside the repository and was skipped.', relative);
      return undefined;
    }
    try {
      const handle = await open(actual, 'r');
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) { this.warn('NON_REGULAR_FILE', 'Non-regular file was skipped.', relative); return undefined; }
        if (stat.size > limit || this.bytes + stat.size > LIMITS.totalBytes) {
          this.warn('SIZE_LIMIT', 'File exceeds the analysis byte budget and was skipped.', relative);
          return undefined;
        }
        // Bound the read even if the file grows after stat().
        const buffer = Buffer.alloc(limit + 1);
        let length = 0;
        while (length < buffer.length) {
          const read = await handle.read(buffer, length, buffer.length - length, null);
          if (read.bytesRead === 0) break;
          length += read.bytesRead;
        }
        if (length > limit || this.bytes + length > LIMITS.totalBytes) {
          this.warn('SIZE_LIMIT', 'File changed beyond the analysis byte budget and was skipped.', relative);
          return undefined;
        }
        this.bytes += length;
        const content = buffer.subarray(0, length);
        const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
        this.hashes.set(relative, textDigest(text));
        return text;
      } finally { await handle.close(); }
    } catch {
      this.warn('UNREADABLE_FILE', 'File could not be read as UTF-8.', relative);
      return undefined;
    }
  }

  digest(): string {
    return createHash('sha256').update(JSON.stringify({
      limits: LIMITS,
      files: [...this.hashes].sort(([a], [b]) => a.localeCompare(b, 'en')),
    })).digest('hex');
  }

  private async walk(directory: string, depth: number): Promise<void> {
    if (depth > LIMITS.depth) {
      this.warn('DEPTH_LIMIT', 'Directory depth limit reached.', portable(path.relative(this.root, directory)));
      this.skipped++;
      return;
    }
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { throw new AnalysisError('UNREADABLE_DIRECTORY', 'A repository directory could not be enumerated.'); }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (++this.entries > LIMITS.entries) throw new AnalysisError('ENTRY_LIMIT', 'Repository exceeds the directory entry limit.');
      if (EXCLUDED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
      const absolute = path.join(directory, entry.name);
      const relative = portable(path.relative(this.root, absolute));
      if (entry.isSymbolicLink()) {
        this.warn('SYMLINK_SKIPPED', 'Symbolic link was not traversed.', relative);
        this.skipped++;
      } else if (entry.isDirectory()) await this.walk(absolute, depth + 1);
      else if (entry.isFile() && entry.name === 'package.json') this.manifests.push(relative);
      else if (entry.isFile() && sourceExtension.test(entry.name)) {
        if (this.sources.size >= LIMITS.files) throw new AnalysisError('FILE_LIMIT', 'Repository exceeds the TypeScript file limit.');
        const content = await this.read(relative, LIMITS.fileBytes);
        if (content !== undefined) this.sources.set(relative, content);
        else this.skipped++;
      }
    }
  }
}
