export const PREVIEW_STAGING_REPOSITORY = Object.freeze({
  githubRepositoryId: '1408947921',
  owner: 'ravitejabolla756-sys',
  name: 'my-owl-staging-affected-openai',
});

export interface PreviewRepositoryIdentity {
  githubRepositoryId: string;
  owner: string;
  name: string;
}

export function previewStagingRepositoryPolicyError(
  repository: PreviewRepositoryIdentity,
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  if (environment.APIPROOF_PREVIEW_STAGING_ISOLATION !== 'true') return null;

  const configured = {
    githubRepositoryId: environment.GITHUB_ALLOWED_REPOSITORY_ID?.trim() ?? '',
    owner: environment.GITHUB_ALLOWED_REPOSITORY_OWNER?.trim() ?? '',
    name: environment.GITHUB_ALLOWED_REPOSITORY_NAME?.trim() ?? '',
  };

  if (configured.githubRepositoryId !== PREVIEW_STAGING_REPOSITORY.githubRepositoryId
    || configured.owner !== PREVIEW_STAGING_REPOSITORY.owner
    || configured.name !== PREVIEW_STAGING_REPOSITORY.name) {
    return 'PREVIEW_STAGING_REPOSITORY_POLICY_REFUSED: configured repository allowlist is not the approved staging fixture';
  }

  if (repository.githubRepositoryId !== PREVIEW_STAGING_REPOSITORY.githubRepositoryId
    || repository.owner !== PREVIEW_STAGING_REPOSITORY.owner
    || repository.name !== PREVIEW_STAGING_REPOSITORY.name) {
    return 'PREVIEW_STAGING_REPOSITORY_POLICY_REFUSED: queued repository is not the approved staging fixture';
  }

  return null;
}

/**
 * Enforces the single-repository boundary for the isolated Preview worker.
 * Normal Production and non-isolated environments retain their existing
 * multi-repository behavior.
 */
export function assertPreviewStagingRepository(
  repository: PreviewRepositoryIdentity,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const error = previewStagingRepositoryPolicyError(repository, environment);
  if (error) throw new Error(error);
}
