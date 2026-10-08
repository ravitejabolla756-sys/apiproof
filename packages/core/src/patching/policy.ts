import { createHash } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { AnalysisError } from '@apiproof/shared';

export const sha256 = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
/** Fixture manifests are authored from canonical LF text; preserve byte-exact hashing elsewhere. */
export const fixtureSha256 = (text: string | Buffer): string => {
  const normalized = (Buffer.isBuffer(text) ? text.toString('utf8') : text).replace(/\r\n/g, '\n');
  return sha256(normalized);
};
export function fail(code: string): never { throw new AnalysisError(code, `Phase 4 patch safety check failed: ${code}.`); }
export function allowedPatchPath(file: string): boolean {
  return /^(?:src|tests|__tests__)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.(?:test|spec))?\.tsx?$/.test(file)
    && !/(?:^|\/)(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|\/|$)/i.test(file)
    && !/(?:^|\/)(?:node_modules|dist|build|coverage|vendor|secrets?|credentials?|config)(?:\/|\.)/i.test(file)
    && !/(?:secret|credential|password|token|config|\.d\.ts)/i.test(file);
}
/** Check every ancestor, including junctions, and reject hard-linked writable files. */
export async function assertPlainPath(target: string): Promise<void> {
  const absolute = path.resolve(target); const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1))) fail('UNSAFE_FILESYSTEM_ENTRY');
  }
  if (path.relative(absolute, await realpath(absolute)) !== '') fail('PATH_ESCAPE');
}
export function dangerous(text: string): boolean {
  return /\b(?:eval|Function|exec|execSync|execFile|spawn|spawnSync|require|import)\s*\(|\b(?:child_process|process|globalThis|fetch|XMLHttpRequest|WebSocket|Deno|Bun)\b|\bfs\s*[.[]|\\u[\da-f]{4}/i.test(text);
}
export function redactPatchContext(source: string): { text: string; redacted: boolean } {
  const text = source.replace(/process\s*(?:\.\s*env(?:\s*\.\s*\w+|\s*\[[^\]]*\])?|\[\s*['"]env['"]\s*\])/g, '[REDACTED_ENV]')
    .replace(/(['"])(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_]+\1/g, '$1[REDACTED_SECRET]$1')
    .replace(/((?:api[_-]?key|secret|token|password|authorization)\s*['"]?\s*[:=]\s*)(['"])[^'"\r\n]*\2/gi, '$1$2[REDACTED_SECRET]$2')
    .replace(/\b(?:Bearer\s+\S+|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, '[REDACTED_SECRET]');
  return { text, redacted: text !== source };
}
