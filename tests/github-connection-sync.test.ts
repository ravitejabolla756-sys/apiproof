import { describe, expect, it } from 'vitest';
import {
  GITHUB_CONNECTION_CHANGED_EVENT,
  createGitHubConnectionChangedMessage,
  isGitHubConnectionChangedMessage,
} from '../apps/web/src/lib/github-connection-sync.js';

describe('GitHub connection cross-tab refresh protocol', () => {
  it('creates a typed connection-change message with workspace context', () => {
    const message = createGitHubConnectionChangedMessage('ws_acc52839e2204df49ee1');

    expect(message.type).toBe(GITHUB_CONNECTION_CHANGED_EVENT);
    expect(message.workspaceId).toBe('ws_acc52839e2204df49ee1');
    expect(Number.isFinite(message.timestamp)).toBe(true);
  });

  it('accepts valid messages and rejects malformed browser events', () => {
    const message = createGitHubConnectionChangedMessage();

    expect(isGitHubConnectionChangedMessage(message)).toBe(true);
    expect(isGitHubConnectionChangedMessage({ type: message.type })).toBe(false);
    expect(isGitHubConnectionChangedMessage({ type: 'other', timestamp: Date.now() })).toBe(false);
    expect(isGitHubConnectionChangedMessage(null)).toBe(false);
  });
});
