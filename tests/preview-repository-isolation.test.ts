import { describe, expect, it } from 'vitest';
import {
  assertPreviewStagingRepository,
  PREVIEW_STAGING_REPOSITORY,
} from '../apps/web/src/lib/server/preview-repository-isolation.js';

const stagingEnvironment: NodeJS.ProcessEnv = {
  APIPROOF_PREVIEW_STAGING_ISOLATION: 'true',
  GITHUB_ALLOWED_REPOSITORY_ID: PREVIEW_STAGING_REPOSITORY.githubRepositoryId,
  GITHUB_ALLOWED_REPOSITORY_OWNER: PREVIEW_STAGING_REPOSITORY.owner,
  GITHUB_ALLOWED_REPOSITORY_NAME: PREVIEW_STAGING_REPOSITORY.name,
};

const stagingRepository = {
  githubRepositoryId: PREVIEW_STAGING_REPOSITORY.githubRepositoryId,
  owner: PREVIEW_STAGING_REPOSITORY.owner,
  name: PREVIEW_STAGING_REPOSITORY.name,
};

describe('isolated Preview repository policy', () => {
  it('accepts only the configured approved staging fixture', () => {
    expect(() => assertPreviewStagingRepository(stagingRepository, stagingEnvironment)).not.toThrow();
  });

  it('rejects a different queued repository even when isolation is enabled', () => {
    expect(() => assertPreviewStagingRepository({ ...stagingRepository, githubRepositoryId: '999999' }, stagingEnvironment))
      .toThrow('queued repository is not the approved staging fixture');
    expect(() => assertPreviewStagingRepository({ ...stagingRepository, name: 'other-repository' }, stagingEnvironment))
      .toThrow('queued repository is not the approved staging fixture');
  });

  it('rejects a missing or conflicting configured allowlist', () => {
    expect(() => assertPreviewStagingRepository(stagingRepository, {
      APIPROOF_PREVIEW_STAGING_ISOLATION: 'true',
    })).toThrow('configured repository allowlist is not the approved staging fixture');
    expect(() => assertPreviewStagingRepository(stagingRepository, {
      ...stagingEnvironment,
      GITHUB_ALLOWED_REPOSITORY_ID: '999999',
    })).toThrow('configured repository allowlist is not the approved staging fixture');
  });

  it('preserves normal non-isolated multi-repository behavior', () => {
    expect(() => assertPreviewStagingRepository({
      githubRepositoryId: '999999',
      owner: 'another-owner',
      name: 'another-repository',
    }, { APIPROOF_PREVIEW_STAGING_ISOLATION: 'false' })).not.toThrow();
  });
});
