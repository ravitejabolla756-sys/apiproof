import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { CandidatePatch, PatchLimits } from '@apiproof/shared';
import type { PatchWorkspace } from './workspace.js';
import { checkWorkspace } from './workspace.js';
import type { PatchGenerationInput } from './context.js';
import { verifiedPatchContext } from './context.js';
import { assertPlainPath, fail, redactPatchContext, sha256 } from './policy.js';
import { syntaxValid } from './transforms.js';
import { validateCandidate } from './validator.js';
import { editDiff } from './diff.js';

/** One standard unified hunk with three unchanged lines around the edited region. */
export function unifiedDiff(file: string, before: string, after: string, contextLines = 3): string {
  if (before === after) return '';
  const lines = (text: string) => { const result = text.split('\n'); if (text.endsWith('\n')) result.pop(); return result; };
  const a = lines(before); const b = lines(after); let prefix = 0; let suffix = 0;
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  while (suffix < Math.min(a.length, b.length) - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  const start = Math.max(0, prefix - contextLines); const tail = Math.min(contextLines, suffix);
  const endA = a.length - suffix + tail; const endB = b.length - suffix + tail;
  const out = [`--- a/${file}`, `+++ b/${file}`, `@@ -${start + 1},${endA - start} +${start + 1},${endB - start} @@`];
  const add = (marker: string, values: string[], from: number, end: number, terminated: boolean) => {
    for (let i = from; i < end; i++) { out.push(marker + values[i]!); if (i === values.length - 1 && !terminated) out.push('\\ No newline at end of file'); }
  };
  add(' ', a, start, prefix, before.endsWith('\n'));
  add('-', a, prefix, a.length - suffix, before.endsWith('\n'));
  add('+', b, prefix, b.length - suffix, after.endsWith('\n'));
  add(' ', b, b.length - suffix, endB, after.endsWith('\n'));
  const diff = out.join('\n') + '\n';
  // A diff is still machine-applicable with zero context; omit secret-like surrounding lines.
  return contextLines > 0 && redactPatchContext(diff).redacted ? unifiedDiff(file, before, after, 0) : diff;
}
export async function applyCandidate(workspace: PatchWorkspace, input: PatchGenerationInput, raw: unknown, limits?: PatchLimits): Promise<CandidatePatch> {
  const canonical = verifiedPatchContext(input, workspace);
  const patch = validateCandidate(raw, canonical, limits);
  if (patch.status !== 'PATCH_READY_FOR_VALIDATION') return patch;
  try { await checkWorkspace(workspace); }
  catch { patch.status = 'PATCH_REJECTED'; patch.validation.push({ stage: 'workspace-snapshot', passed: false, code: 'SOURCE_DIGEST_OR_PATH_MISMATCH' }); return patch; }
  patch.validation.push({ stage: 'workspace-snapshot', passed: true, code: 'OK' });
  const expected: Record<string, string> = { ...workspace.snapshot };
  for (const file of patch.files) {
    let text = expected[file.path]!;
    for (const edit of [...file.edits].sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
    expected[file.path] = text;
    if (!syntaxValid(file.path, text)) { patch.status = 'PATCH_STATIC_VALIDATION_FAILED'; patch.validation.push({ stage: 'syntax', passed: false, code: 'TYPESCRIPT_SYNTAX_ERROR' }); return patch; }
    file.unifiedDiff = editDiff(file.path, workspace.snapshot[file.path]!, text, file.edits);
    if (redactPatchContext(file.unifiedDiff).redacted) { patch.status = 'PATCH_REJECTED'; patch.files = []; patch.validation.push({ stage: 'diff-context', passed: false, code: 'SECRET_LIKE_DIFF_CONTEXT' }); return patch; }
  }
  try {
    for (const file of patch.files) {
      const destination = path.join(workspace.directory, file.path); await assertPlainPath(destination);
      const handle = await open(destination, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || sha256(await handle.readFile()) !== file.originalDigest) fail('SOURCE_DIGEST_MISMATCH');
        const bytes = Buffer.from(expected[file.path]!, 'utf8');
        let offset = 0;
        while (offset < bytes.length) { const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset, offset); if (!bytesWritten) fail('WRITE_FAILED'); offset += bytesWritten; }
        await handle.truncate(bytes.length); await handle.sync();
      } finally { await handle.close(); }
      file.patchedDigest = sha256(expected[file.path]!);
    }
    await checkWorkspace(workspace, expected);
    patch.validation.push({ stage: 'apply', passed: true, code: 'OK' }, { stage: 'syntax', passed: patch.files.every((file) => syntaxValid(file.path, expected[file.path]!)), code: 'OK' });
  } catch { patch.status = 'PATCH_APPLY_FAILED'; patch.validation.push({ stage: 'apply', passed: false, code: 'WORKSPACE_APPLY_FAILED' }); patch.warnings.push('Disposable workspace may contain partial edits; discard this run.'); }
  return patch;
}
