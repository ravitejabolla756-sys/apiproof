const PROTECTED_BRANCH_NAMES = new Set([
  'main',
  'master',
  'develop',
  'development',
  'production',
  'staging',
  'release',
  'head',
  'base',
]);

const PROTECTED_PREFIXES = [
  'refs/',
  'heads/',
  'release/',
  'feature/',
  'bugfix/',
  'hotfix/',
];

export function validateBranchName(branch: string): { valid: boolean; reason?: string } {
  if (!branch || typeof branch !== 'string') {
    return { valid: false, reason: 'Branch name must be a non-empty string.' };
  }
  if (branch.length > 100) {
    return { valid: false, reason: 'Branch name exceeds maximum allowed length of 100 characters.' };
  }
  if (!branch.startsWith('apiproof/')) {
    return { valid: false, reason: 'Branch name must start with apiproof/ namespace.' };
  }
  if (branch === 'apiproof/' || branch.endsWith('/')) {
    return { valid: false, reason: 'Branch name cannot be empty under namespace or end with a slash.' };
  }
  if (branch.includes('..') || branch.includes('\\') || branch.includes('//')) {
    return { valid: false, reason: 'Branch name contains invalid path traversal or consecutive slashes.' };
  }
  if (/[\s\0\r\n\t~^:?*[\]@{}]/.test(branch)) {
    return { valid: false, reason: 'Branch name contains forbidden control or git special characters.' };
  }
  const subPath = branch.slice('apiproof/'.length);
  const subLower = subPath.toLowerCase();
  if (PROTECTED_BRANCH_NAMES.has(subLower)) {
    return { valid: false, reason: `Branch name target '${subPath}' is a protected branch name.` };
  }
  for (const prefix of PROTECTED_PREFIXES) {
    if (subLower.startsWith(prefix)) {
      return { valid: false, reason: `Branch name target contains protected prefix '${prefix}'.` };
    }
  }
  return { valid: true };
}

export function generateSafeBranchName(changeId: string, shortRunId: string): string {
  const sanitizedChange = changeId.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const sanitizedRun = shortRunId.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const candidate = `apiproof/${sanitizedChange}-${sanitizedRun}`;
  const validation = validateBranchName(candidate);
  if (!validation.valid) {
    throw new Error(`GITHUB_INVALID_BRANCH_NAME: ${validation.reason}`);
  }
  return candidate;
}
