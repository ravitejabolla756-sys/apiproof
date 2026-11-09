import { describe, expect, it } from 'vitest';
import { parseGitHubConnectionStatus, parseGitHubInstallationResponse } from '../apps/web/src/lib/github-installation-contract.js';

describe('GitHub installation response', () => {
  it('accepts disconnected and connected workspace states', () => {
    expect(parseGitHubInstallationResponse({ connected: false, repositories: [] })).toMatchObject({ connected: false, installation: null });
    expect(parseGitHubInstallationResponse({ connected: true, installation: { id: 'install-1', accountLogin: 'acme', accountType: 'Organization' } })).toMatchObject({ connected: true });
  });

  it('rejects incomplete installation metadata', () => {
    expect(parseGitHubInstallationResponse({ connected: true, installation: { id: 'install-1' } })).toBeNull();
    expect(parseGitHubInstallationResponse({ connected: 'yes' })).toBeNull();
  });

  it('returns null for malformed shell status responses', () => {
    expect(parseGitHubConnectionStatus({ connected: true })).toBe(true);
    expect(parseGitHubConnectionStatus({ connected: 'true' })).toBeNull();
    expect(parseGitHubConnectionStatus(null)).toBeNull();
  });
});
