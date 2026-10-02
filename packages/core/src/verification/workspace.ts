export type VerificationPackageManager = 'pnpm' | 'npm' | 'yarn';
export interface VerificationWorkspaceCommands {
  id: string;
  executionAllowed: true;
  packageManager: VerificationPackageManager;
  commands: { install: string[]; build: string[]; typecheck: string[]; test: string[] };
}

const LOCKFILES: Record<VerificationPackageManager, string> = {
  pnpm: 'pnpm-lock.yaml',
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
};
const PINNED_PNPM_VERSION = '10.30.3';
const PINNED_NPM_VERSION = '10.9.2';
/** Selects one deterministic, offline package-manager command set from the exact workspace manifest. */
export function buildVerificationWorkspaceCommands(id: string, files: ReadonlyMap<string, string>): VerificationWorkspaceCommands {
  const packageJson = files.get('package.json');
  if (!packageJson) throw new Error('VERIFICATION_PACKAGE_MANIFEST_MISSING: A root package.json is required.');
  let manifest: { packageManager?: unknown };
  try { manifest = JSON.parse(packageJson) as typeof manifest; }
  catch { throw new Error('VERIFICATION_PACKAGE_MANIFEST_INVALID: Root package.json is invalid.'); }

  const lockfiles = Object.values(LOCKFILES).filter((name) => files.has(name));
  if (lockfiles.length !== 1) throw new Error('VERIFICATION_LOCKFILE_REQUIRED: Exactly one supported root lockfile is required for deterministic offline installation.');
  const lockfile = lockfiles[0]!;
  const packageManagerText = typeof manifest.packageManager === 'string' ? manifest.packageManager : undefined;
  const declared = packageManagerText?.match(/^(pnpm|npm|yarn)@(\d+\.\d+\.\d+)(?:\+[A-Za-z0-9._-]+)?$/);
  if (packageManagerText && !declared) throw new Error('VERIFICATION_PACKAGE_MANAGER_UNSUPPORTED: packageManager must declare an exact supported package-manager version.');
  const manager = (Object.entries(LOCKFILES).find(([, expected]) => expected === lockfile)?.[0]) as VerificationPackageManager | undefined;
  if (!manager || (declared && declared[1] !== manager)) throw new Error('VERIFICATION_LOCKFILE_MISMATCH: packageManager and root lockfile do not agree.');
  if (manager === 'yarn' && !declared) throw new Error('VERIFICATION_PACKAGE_MANAGER_VERSION_REQUIRED: Yarn requires an exact packageManager version.');
  const version = declared?.[2] ?? PINNED_PNPM_VERSION;
  if ((manager === 'pnpm' && version !== PINNED_PNPM_VERSION) || (manager === 'yarn' && version !== '1.22.22')) throw new Error('VERIFICATION_PACKAGE_MANAGER_UNSUPPORTED: Only pinned pnpm 10.30.3 and Yarn Classic 1.22.22 are supported.');
  if (manager === 'npm' && declared && version !== PINNED_NPM_VERSION) throw new Error('VERIFICATION_PACKAGE_MANAGER_UNSUPPORTED: npm version must match the pinned Node verifier image.');
  if (manager === 'pnpm' && !declared && lockfile !== LOCKFILES.pnpm) throw new Error('VERIFICATION_LOCKFILE_MISMATCH: pnpm requires pnpm-lock.yaml.');

  const runner = manager === 'npm' ? ['npm'] : ['corepack', `${manager}@${version}`];
  const commands = manager === 'pnpm'
    ? { install: [...runner, 'install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--store-dir', '/provisioned-dependencies/pnpm-store'], build: [...runner, 'exec', 'tsc', '--noEmit'], typecheck: [...runner, 'exec', 'tsc', '--noEmit'], test: [...runner, 'exec', 'vitest', 'run'] }
    : manager === 'npm'
      ? { install: [...runner, 'ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', '/provisioned-dependencies/npm-cache'], build: [...runner, 'exec', '--offline', '--', 'tsc', '--noEmit'], typecheck: [...runner, 'exec', '--offline', '--', 'tsc', '--noEmit'], test: [...runner, 'exec', '--offline', '--', 'vitest', 'run'] }
      : { install: [...runner, 'install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--cache-folder', '/provisioned-dependencies/yarn-cache'], build: ['./node_modules/.bin/tsc', '--noEmit'], typecheck: ['./node_modules/.bin/tsc', '--noEmit'], test: ['./node_modules/.bin/vitest', 'run'] };
  return { id, executionAllowed: true, packageManager: manager, commands };
}
