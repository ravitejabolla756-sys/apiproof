import { describe, expect, it } from 'vitest';
import { parseSlackConnectionStatus } from '../apps/web/src/lib/slack-connection-contract.js';

describe('Slack connection response', () => {
  it('accepts connected and disconnected projections', () => {
    expect(parseSlackConnectionStatus({ connected: true, teamName: ' Fixture Slack ' })).toEqual({ connected: true, teamName: 'Fixture Slack' });
    expect(parseSlackConnectionStatus({ connected: false })).toEqual({ connected: false, teamName: null });
  });

  it('preserves a connected state without inventing a workspace name', () => {
    expect(parseSlackConnectionStatus({ connected: true, teamName: '   ' })).toEqual({ connected: true, teamName: null });
  });

  it('rejects malformed status projections', () => {
    expect(parseSlackConnectionStatus({ connected: 'true' })).toBeNull();
    expect(parseSlackConnectionStatus({ connected: true, teamName: 42 })).toBeNull();
    expect(parseSlackConnectionStatus(null)).toBeNull();
  });
});
