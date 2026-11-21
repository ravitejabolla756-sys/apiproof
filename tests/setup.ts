import { beforeEach } from 'vitest';

// The candidate’s scan service is fail-closed unless the live GitHub rollout
// flag is enabled. Local tests use mocked providers and must opt into that
// explicit test-only contract; tests that exercise the disabled path override
// the value in their own setup.
beforeEach(() => {
  process.env.APIPROOF_ENABLE_LIVE_GITHUB = 'true';
});
