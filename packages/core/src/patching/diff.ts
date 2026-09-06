import type { PatchEdit } from '@apiproof/shared';
import { redactPatchContext } from './policy.js';

interface Region { start: number; end: number; newStart: number; newEnd: number }
/** Construct hunks from authorized ranges; unchanged lines between distant edits are never rewritten. */
export function editDiff(file: string, before: string, after: string, edits: PatchEdit[], context = 3): string {
  const split = (text: string) => { const lines = text.split('\n'); if (text.endsWith('\n')) lines.pop(); return lines; };
  const oldLines = split(before); const newLines = split(after);
  const regions: Region[] = []; let delta = 0;
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    const start = before.slice(0, edit.start).split('\n').length - 1;
    const end = before.slice(0, edit.end).split('\n').length;
    const change = edit.replacement.split('\n').length - edit.expected.split('\n').length;
    const previous = regions.at(-1);
    if (previous && start < previous.end) { previous.end = Math.max(previous.end, end); previous.newEnd = Math.max(previous.newEnd, end + delta + change); }
    else regions.push({ start, end, newStart: start + delta, newEnd: end + delta + change });
    delta += change;
  }
  const groups: Region[][] = [];
  for (const region of regions) {
    const group = groups.at(-1);
    if (group && region.start - group.at(-1)!.end <= context * 2) group.push(region); else groups.push([region]);
  }
  const out = [`--- a/${file}`, `+++ b/${file}`];
  const append = (marker: string, lines: string[], start: number, end: number, terminated: boolean) => {
    for (let i = start; i < end; i++) { out.push(marker + lines[i]!); if (i === lines.length - 1 && !terminated) out.push('\\ No newline at end of file'); }
  };
  for (const group of groups) {
    const first = group[0]!; const last = group.at(-1)!;
    const start = Math.max(0, first.start - context); const end = Math.min(oldLines.length, last.end + context);
    const newStart = first.newStart - (first.start - start); const newEnd = last.newEnd + (end - last.end);
    out.push(`@@ -${start + 1},${end - start} +${newStart + 1},${newEnd - newStart} @@`);
    let cursor = start;
    for (const region of group) {
      append(' ', oldLines, cursor, region.start, before.endsWith('\n'));
      append('-', oldLines, region.start, region.end, before.endsWith('\n'));
      append('+', newLines, region.newStart, region.newEnd, after.endsWith('\n'));
      cursor = region.end;
    }
    append(' ', oldLines, cursor, end, before.endsWith('\n'));
  }
  const diff = out.join('\n') + '\n';
  return context > 0 && redactPatchContext(diff).redacted ? editDiff(file, before, after, edits, 0) : diff;
}
