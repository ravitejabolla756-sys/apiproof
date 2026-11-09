import { describe, expect, it, vi } from 'vitest';
import { openGitHubAuthorizationPopup, type GitHubAuthorizationPopup } from '../apps/web/src/lib/github-oauth-popup.js';

function fakePopup(): GitHubAuthorizationPopup {
  return {
    opener: {},
    location: { replace: vi.fn() },
    close: vi.fn(),
  };
}

describe('GitHub OAuth popup launch', () => {
  it('opens synchronously before requesting the authorization URL and navigates the reserved tab', async () => {
    const popup = fakePopup();
    const calls: string[] = [];
    let resolveUrl!: (url: string) => void;
    const loadUrl = vi.fn(() => {
      calls.push('load');
      return new Promise<string>((resolve) => { resolveUrl = resolve; });
    });
    const open = vi.fn(() => {
      calls.push('open');
      return popup;
    });

    const result = openGitHubAuthorizationPopup(loadUrl, open);
    expect(calls).toEqual(['open', 'load']);
    expect(popup.opener).toBeNull();

    resolveUrl('https://github.com/apps/my-owl/installations/new');
    await result;

    expect(popup.location.replace).toHaveBeenCalledWith('https://github.com/apps/my-owl/installations/new');
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('reports a blocked popup without requesting an authorization URL', async () => {
    const loadUrl = vi.fn();
    await expect(openGitHubAuthorizationPopup(loadUrl, () => null)).rejects.toThrow('GITHUB_POPUP_BLOCKED');
    expect(loadUrl).not.toHaveBeenCalled();
  });

  it('closes the reserved tab when authorization URL loading fails', async () => {
    const popup = fakePopup();
    await expect(openGitHubAuthorizationPopup(
      async () => { throw new Error('install URL unavailable'); },
      () => popup,
    )).rejects.toThrow('install URL unavailable');
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('rejects unsafe authorization URLs before navigating the popup', async () => {
    const popup = fakePopup();
    await expect(openGitHubAuthorizationPopup(async () => 'javascript:alert(1)', () => popup)).rejects.toThrow('GITHUB_AUTHORIZATION_URL_INVALID');
    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalledOnce();
  });
});
