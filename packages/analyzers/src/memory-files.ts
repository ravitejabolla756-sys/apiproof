import { Buffer } from 'node:buffer';

export const MEMORY_SNAPSHOT_LIMITS = {
  files: 5_000,
  fileBytes: 1_048_576,
  totalBytes: 33_554_432,
} as const;

export type MemorySnapshotDiagnostic = {
  code: 'INVALID_PATH' | 'DUPLICATE_PATH' | 'SIZE_LIMIT' | 'FILE_LIMIT' | 'TOTAL_SIZE_LIMIT';
  message: string;
  file?: string;
};

export type MemorySnapshotInput = ReadonlyMap<string, string> | Record<string, string>;

function normalizePath(file: string): string | undefined {
  const normalized = file.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return undefined;
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '..')) return undefined;
  return segments.join('/');
}

/**
 * Bounds caller-provided repository maps before any language adapter sees them.
 * This path is used for archive/API inputs and therefore must not trust keys or
 * content sizes merely because the filesystem snapshot is already bounded.
 */
export function sanitizeMemoryFiles(input: MemorySnapshotInput): { files: Map<string, string>; diagnostics: MemorySnapshotDiagnostic[] } {
  const values = input instanceof Map ? [...input.entries()] : Object.entries(input);
  const files = new Map<string, string>();
  const diagnostics: MemorySnapshotDiagnostic[] = [];
  let totalBytes = 0;

  for (const [rawPath, content] of values) {
    const file = normalizePath(rawPath);
    if (!file) {
      diagnostics.push({ code: 'INVALID_PATH', message: 'Repository file path is absolute or escapes the repository boundary.', file: rawPath });
      continue;
    }
    if (files.has(file)) {
      diagnostics.push({ code: 'DUPLICATE_PATH', message: 'Duplicate normalized repository file path was skipped.', file });
      continue;
    }
    if (files.size >= MEMORY_SNAPSHOT_LIMITS.files) {
      diagnostics.push({ code: 'FILE_LIMIT', message: 'Repository exceeds the in-memory file limit.', file });
      continue;
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MEMORY_SNAPSHOT_LIMITS.fileBytes) {
      diagnostics.push({ code: 'SIZE_LIMIT', message: 'Repository file exceeds the in-memory file-size limit.', file });
      continue;
    }
    if (totalBytes + bytes > MEMORY_SNAPSHOT_LIMITS.totalBytes) {
      diagnostics.push({ code: 'TOTAL_SIZE_LIMIT', message: 'Repository exceeds the in-memory byte budget.', file });
      continue;
    }
    files.set(file, content);
    totalBytes += bytes;
  }

  return { files, diagnostics };
}
