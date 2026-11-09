import { describe, expect, it } from 'vitest';
import { parseGitHubInstallationResponse } from '../apps/web/src/lib/github-installation-contract.js';

describe('GitHub installation response', () => {
  it('accepts disconnected and connected workspace states', () => {
    expect(parseGitHubInstallationResponse({ connected: false, repositories: [] })).toMatchObject({ connected: false, installation: null });
    expect(parseGitHubInstallationResponse({ connected: true, installation: { id: 'install-1', accountLogin: 'acme', accountType: 'Organization' } })).toMatchObject({ connected: true });
  });

  it('rejects incomplete installation metadata', () => {
    expect(parseGitHubInstallationResponse({ connected: true, installation: { id: 'install-1' } })).toBeNull();
    expect(parseGitHubInstallationResponse({ connected: 'yes' })).toBeNull();
  });
});
