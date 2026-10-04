import { createHash } from 'node:crypto';

export class GoRepositorySnapshot {
  readonly hashes = new Map<string, string>();
  readonly diagnostics: { code: string; message: string; file?: string }[] = [];

  private constructor(readonly files: ReadonlyMap<string, string>) {
    for (const [file, content] of files) this.hashes.set(file, createHash('sha256').update(content).digest('hex'));
  }

  static fromMemory(files: ReadonlyMap<string, string> | Record<string, string>): GoRepositorySnapshot {
    const values = files instanceof Map ? files : new Map(Object.entries(files));
    return new GoRepositorySnapshot(new Map([...values].map(([file, content]) => [file.replaceAll('\\', '/'), content])));
  }

  sourceFiles(): readonly [string, string][] { return [...this.files].filter(([file]) => file.endsWith('.go')); }
  read(file: string): string | undefined { return this.files.get(file); }
  digest(): string { return createHash('sha256').update(JSON.stringify([...this.hashes].sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex'); }
}
