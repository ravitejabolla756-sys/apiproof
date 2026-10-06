/** Server-only rollback boundary for the Productization V1 scan path. */
export function providerIntelligenceV1Enabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.PROVIDER_INTELLIGENCE_V1_ENABLED === 'true';
}
