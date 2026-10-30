import { createHash } from 'node:crypto';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { TOOL_VERSION } from '@apiproof/shared';

const PROVIDER_REGISTRY_DIGEST = createHash('sha256')
  .update(JSON.stringify(PRODUCTION_COMPATIBILITY_REGISTRY.changes))
  .digest('hex');

/** Server-only rollback boundary for the Productization V1 scan path. */
export function providerIntelligenceV1Enabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.PROVIDER_INTELLIGENCE_V1_ENABLED === 'true';
}

export function workerRuntimeIdentity(environment: NodeJS.ProcessEnv = process.env): {
  workerCommitSha: string;
  productizationV1Enabled: boolean;
  workerVersion: string;
  providerRegistryDigest: string;
} {
  const commitSha = environment.VERCEL_GIT_COMMIT_SHA ?? environment.GIT_COMMIT_SHA ?? '';
  return {
    workerCommitSha: /^[a-f0-9]{40,64}$/i.test(commitSha) ? commitSha : 'unknown',
    productizationV1Enabled: providerIntelligenceV1Enabled(environment),
    workerVersion: TOOL_VERSION,
    providerRegistryDigest: PROVIDER_REGISTRY_DIGEST,
  };
}
