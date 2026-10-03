import { describe, expect, it } from 'vitest';
import { buildDockerProcessEnvironment } from '../packages/core/src/verification/docker-process.js';

describe('Docker CLI subprocess environment', () => {
  it('preserves Docker Desktop context/config and home discovery without forwarding secrets', () => {
    const environment = buildDockerProcessEnvironment({
      PATH: 'C:\\Docker;C:\\Windows',
      DOCKER_CONTEXT: 'desktop-linux',
      DOCKER_CONFIG: 'C:\\Users\\dev\\.docker',
      USERPROFILE: 'C:\\Users\\dev',
      HOMEDRIVE: 'C:',
      HOMEPATH: '\\Users\\dev',
      DATABASE_URL: 'must-not-be-forwarded',
      GITHUB_APP_PRIVATE_KEY: 'must-not-be-forwarded',
      APIPROOF_SECRET: 'must-not-be-forwarded',
    });

    expect(environment).toEqual({
      PATH: 'C:\\Docker;C:\\Windows',
      DOCKER_CONTEXT: 'desktop-linux',
      DOCKER_CONFIG: 'C:\\Users\\dev\\.docker',
      USERPROFILE: 'C:\\Users\\dev',
      HOMEDRIVE: 'C:',
      HOMEPATH: '\\Users\\dev',
      CI: 'true',
    });
  });
});
