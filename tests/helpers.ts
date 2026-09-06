import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'vitest';
import { ApiProof } from '@apiproof/core';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { StripeProvider } from '@apiproof/providers';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const fixture = (name: string) => path.join(root, 'test-fixtures', name);
export const provider = new StripeProvider();
export const proof = new ApiProof(new TypeScriptRepositoryAnalyzer(), provider);
export const change: unknown = JSON.parse(await readFile(path.join(root, 'fixtures/stripe-change.json'), 'utf8'));

const temporary: string[] = [];
afterEach(async () => {
  for (const directory of temporary.splice(0)) {
    // Only remove directories created by this test process under its temp root.
    if (!path.resolve(directory).startsWith(path.join(tmpdir(), 'apiproof-test-'))) throw new Error('Unsafe cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});

export async function repository(files: Record<string, string> = {}): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'apiproof-test-'));
  temporary.push(directory);
  const contents = { 'package.json': '{"name":"test","dependencies":{"stripe":"^16.0.0"}}', ...files };
  for (const [file, content] of Object.entries(contents)) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return directory;
}
