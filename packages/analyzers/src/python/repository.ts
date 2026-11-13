import { createHash } from 'node:crypto';
import { sanitizeMemoryFiles, type MemorySnapshotInput } from '../memory-files.js';

export class PythonRepositorySnapshot {
  readonly hashes = new Map<string, string>();
  readonly diagnostics: { code: string; message: string; file?: string }[] = [];

  private constructor(readonly files: ReadonlyMap<string, string>, diagnostics: readonly { code: string; message: string; file?: string }[] = []) {
    this.diagnostics.push(...diagnostics);
    for (const [file, content] of files) this.hashes.set(file, createHash('sha256').update(content).digest('hex'));
  }

  static fromMemory(files: MemorySnapshotInput): PythonRepositorySnapshot {
    const sanitized = sanitizeMemoryFiles(files);
    return new PythonRepositorySnapshot(sanitized.files, sanitized.diagnostics);
  }

  sourceFiles(): readonly [string, string][] {
    return [...this.files].filter(([file]) => /\.(?:py|pyi)$/i.test(file));
  }

  read(file: string): string | undefined { return this.files.get(file); }

  digest(): string {
    return createHash('sha256').update(JSON.stringify([...this.hashes].sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex');
  }
}
