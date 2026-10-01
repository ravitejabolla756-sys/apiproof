export const GITHUB_CONNECTION_CHANGED_EVENT = 'myowl:github-connection-changed';
export const GITHUB_CONNECTION_STORAGE_KEY = 'myowl:github-connection-changed';

export interface GitHubConnectionChangedMessage {
  type: typeof GITHUB_CONNECTION_CHANGED_EVENT;
  workspaceId?: string;
  timestamp: number;
}

export function createGitHubConnectionChangedMessage(workspaceId?: string): GitHubConnectionChangedMessage {
  return {
    type: GITHUB_CONNECTION_CHANGED_EVENT,
    workspaceId,
    timestamp: Date.now(),
  };
}

export function isGitHubConnectionChangedMessage(value: unknown): value is GitHubConnectionChangedMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<GitHubConnectionChangedMessage>;
  return message.type === GITHUB_CONNECTION_CHANGED_EVENT && typeof message.timestamp === 'number';
}

export function publishGitHubConnectionChanged(workspaceId?: string): void {
  if (typeof window === 'undefined') return;
  const message = createGitHubConnectionChangedMessage(workspaceId);

  try {
    const channel = new BroadcastChannel(GITHUB_CONNECTION_CHANGED_EVENT);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Safari/private browsing may not expose BroadcastChannel.
  }

  try {
    window.localStorage.setItem(GITHUB_CONNECTION_STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Storage can be unavailable; polling remains the fallback.
  }
}
