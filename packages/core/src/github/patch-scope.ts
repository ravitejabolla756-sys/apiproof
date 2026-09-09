export const FORBIDDEN_FILE_PATTERNS = [
  /^\.github\//i,
  /^\.env(?:\.|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /\.id_rsa$/i,
  /\.credentials$/i,
  /^\.git\//i,
  /^\.vscode\//i,
  /^\.idea\//i,
];

export function isForbiddenSystemPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalized.includes('..')) return true;
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}

export function validatePatchScope(
  actualPatchFiles: string[],
  allowedFiles: string[]
): { valid: boolean; reason?: string; forbiddenFile?: string; extraFile?: string } {
  if (!Array.isArray(actualPatchFiles) || actualPatchFiles.length === 0) {
    return { valid: false, reason: 'Patch file list is empty.' };
  }
  const allowedSet = new Set(allowedFiles.map((f) => f.replace(/\\/g, '/').replace(/^\.\//, '')));

  for (const file of actualPatchFiles) {
    const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
    if (isForbiddenSystemPath(normalized)) {
      return {
        valid: false,
        reason: `Patch includes forbidden system path: ${normalized}`,
        forbiddenFile: normalized,
      };
    }
    if (!allowedSet.has(normalized)) {
      return {
        valid: false,
        reason: `Patch touches file outside verified migration plan scope: ${normalized}`,
        extraFile: normalized,
      };
    }
  }

  return { valid: true };
}
