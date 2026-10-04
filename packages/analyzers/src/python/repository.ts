import { createHash } from 'node:crypto';

export class PythonRepositorySnapshot {
  readonly hashes = new Map<string, string>();
  readonly diagnostics: { code: string; message: string; file?: string }[] = [];

  private constructor(readonly files: ReadonlyMap<string, string>) {
    for (const [file, content] of files) this.hashes.set(file, createHash('sha256').update(content).digest('hex'));
  }

  static fromMemory(files: ReadonlyMap<string, string> | Record<string, string>): PythonRepositorySnapshot {
    const values = files instanceof Map ? files : new Map(Object.entries(files));
    return new PythonRepositorySnapshot(new Map([...values].map(([file, content]) => [file.replaceAll('\\', '/'), content])));
  }

  sourceFiles(): readonly [string, string][] {
    return [...this.files].filter(([file]) => /\.(?:py|pyi)$/i.test(file));
  }

  read(file: string): string | undefined { return this.files.get(file); }

  digest(): string {
    return createHash('sha256').update(JSON.stringify([...this.hashes].sort(([a], [b]) => a.localeCompare(b, 'en')))).digest('hex');
  }
}
