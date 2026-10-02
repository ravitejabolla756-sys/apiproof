import { describe, expect, it } from 'vitest';
import {
  isCurrentRepositoryRequest,
  shouldReloadRepositoriesAfterStatusRefresh,
} from '../apps/web/src/lib/github-repository-picker.js';
import {
  createGitHubConnectionChangedMessage,
  isGitHubConnectionChangedMessage,
} from '../apps/web/src/lib/github-connection-sync.js';

describe('GitHub repository picker refresh policy', () => {
  it('loads on modal open, then leaves the loaded list alone for unchanged status polls', () => {
    expect(shouldReloadRepositoriesAfterStatusRefresh(false, null, true)).toBe(false);
    expect(shouldReloadRepositoriesAfterStatusRefresh(true, true, true)).toBe(false);
    expect(shouldReloadRepositoriesAfterStatusRefresh(true, false, false)).toBe(false);
  });

  it('repeated background polls keep the rendered repositories and current selection intact', () => {
    const picker: {
      repositories: Array<{ id: string; fullName: string }>;
      selectedRepoId: string | null;
    } = {
      repositories: [{ id: 'repo-1', fullName: 'owner/repo' }],
      selectedRepoId: 'repo-1',
    };

    for (let poll = 0; poll < 5; poll += 1) {
      if (shouldReloadRepositoriesAfterStatusRefresh(true, true, true)) {
        picker.repositories = [];
        picker.selectedRepoId = null;
      }
    }

    expect(picker.repositories).toHaveLength(1);
    expect(picker.selectedRepoId).toBe('repo-1');
  });

  it('reloads repositories only after a loaded picker observes a connection change', () => {
    expect(shouldReloadRepositoriesAfterStatusRefresh(true, false, true)).toBe(true);
    expect(shouldReloadRepositoriesAfterStatusRefresh(true, true, false)).toBe(true);
  });

  it('ignores stale repository and status responses after a newer request starts', () => {
    expect(isCurrentRepositoryRequest(1, 2)).toBe(false);
    expect(isCurrentRepositoryRequest(2, 2)).toBe(true);
  });

  it('accepts callback synchronization messages so the active modal can refresh after new-tab OAuth', () => {
    const message = createGitHubConnectionChangedMessage('ws_test');
    expect(isGitHubConnectionChangedMessage(message)).toBe(true);
    expect(shouldReloadRepositoriesAfterStatusRefresh(true, false, true)).toBe(true);
  });
});
