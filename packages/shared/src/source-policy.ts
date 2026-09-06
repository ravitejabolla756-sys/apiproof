export const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', '.git', '.next', '.pnpm-store']);

export function isAnalyzableSourcePath(file: string): boolean {
  const segments = file.replaceAll('\\', '/').split('/');
  return /\.(?:ts|tsx|mts|cts)$/i.test(file) &&
    segments.every((segment) => !!segment && !segment.startsWith('.') && !EXCLUDED_DIRECTORIES.has(segment));
}
