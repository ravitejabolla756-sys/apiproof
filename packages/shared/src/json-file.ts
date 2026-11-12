import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AnalysisError } from './errors.js';

export function literalHash(value: string | number | boolean | null): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Shared bounded JSON input reader; never imports or executes configuration. */
export async function readTextFile(file: string, boundary?: string, limit = 262_144): Promise<string> {
  try {
    const actual = await realpath(file);
    if (boundary) {
      const root = await realpath(boundary);
      const relative = path.relative(root, actual);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error();
    }
    const handle = await open(actual, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > limit) throw new Error();
      const buffer = Buffer.alloc(limit + 1);
      let length = 0;
      while (length < buffer.length) {
        const read = await handle.read(buffer, length, buffer.length - length, null);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > limit) throw new Error();
      // Canonicalize text before hashing/parsing so identical repository files
      // produce identical evidence on Windows (CRLF) and Linux (LF).
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)).replace(/\r\n?/g, '\n');
    } finally { await handle.close(); }
  } catch { throw new AnalysisError('INVALID_INPUT_FILE', 'Input is unreadable, outside its boundary, or exceeds its byte limit.'); }
}

export async function readJsonFile(file: string, boundary?: string, limit = 262_144): Promise<unknown> {
  try { return JSON.parse(await readTextFile(file, boundary, limit)) as unknown; }
  catch { throw new AnalysisError('INVALID_JSON_FILE', 'JSON input is unreadable, outside its boundary, malformed, or exceeds its byte limit.'); }
}
