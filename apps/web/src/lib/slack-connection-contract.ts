export type SlackConnectionProjection = {
  connected: boolean;
  teamName: string | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the workspace-scoped Slack connection projection before rendering it. */
export function parseSlackConnectionStatus(value: unknown): SlackConnectionProjection | null {
  if (!record(value) || typeof value.connected !== 'boolean') return null;
  if (value.teamName !== undefined && value.teamName !== null && typeof value.teamName !== 'string') return null;
  const teamName = typeof value.teamName === 'string' && value.teamName.trim().length > 0
    ? value.teamName.trim()
    : null;
  return { connected: value.connected, teamName };
}
import { toSafeNavigationUrl } from './external-link-contract.js';


/** Keep provider-returned OAuth redirects inert unless they are safe navigations. */
export function parseSlackConnectResponse(value: unknown): string | null {
  if (!record(value) || typeof value.url !== 'string') return null;
  return toSafeNavigationUrl(value.url);
}
