import { describe, expect, it } from 'vitest';
import { buildDockerProcessArgs, buildDockerProcessEnvironment } from '../packages/core/src/verification/docker-process.js';

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

  it('passes the selected context explicitly to Docker instead of relying on CLI discovery', () => {
    expect(buildDockerProcessArgs(['image', 'inspect', 'node:22.14.0-alpine3.21'], {
      DOCKER_CONTEXT: 'desktop-linux',
    })).toEqual(['--context', 'desktop-linux', 'image', 'inspect', 'node:22.14.0-alpine3.21']);
  });

  it('leaves normal Docker context discovery intact when no context is configured', () => {
    expect(buildDockerProcessArgs(['info'], {})).toEqual(['info']);
  });
});
