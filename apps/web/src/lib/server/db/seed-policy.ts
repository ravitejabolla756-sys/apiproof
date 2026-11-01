/**
 * Default fixture seeding is retained for existing local/test behavior.
 * Only the exact literal `true` enables the empty-database path.
 */
export function skipDefaultSeed(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.APIPROOF_SKIP_DEFAULT_SEED === 'true';
}
