import { getDatabase } from './db/index.js';
import { requireFindingAccess, requireWorkspaceMember } from './workspace-service.js';

export interface SlackFindingBinding {
  slack_connection_id: string;
  workspace_id: string;
  repository_id: string;
  finding_id: string;
}

export interface AuthorizedSlackConnection {
  id: string;
  connected_by: string;
  installer_slack_user_id: string;
  team_id: string;
  token_ciphertext: string;
  token_iv: string;
  token_auth_tag: string;
  updated_at: string;
}

/** Slack identities do not confer MY OWL access. Revalidate the current installer on every dispatch. */
export async function requireSlackFindingAuthorization(binding: SlackFindingBinding) {
  const connection = await getDatabase().queryOne<AuthorizedSlackConnection>(`
    SELECT sc.* FROM slack_connections sc JOIN users u ON u.id = sc.connected_by
    JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = sc.workspace_id
    JOIN repositories r ON r.id = ? AND r.workspace_id = sc.workspace_id AND r.lifecycle = 'active'
    JOIN findings f ON f.id = ? AND f.repository_id = r.id
    WHERE sc.id = ? AND sc.workspace_id = ? AND sc.status = 'active'
  `, [binding.repository_id, binding.finding_id, binding.slack_connection_id, binding.workspace_id]);
  if (!connection) throw new Error('SLACK_DELIVERY_UNAUTHORIZED');
  try {
    await requireWorkspaceMember(connection.connected_by, binding.workspace_id);
    const access = await requireFindingAccess(binding.finding_id, connection.connected_by);
    if (access.finding.id !== binding.finding_id || access.repository.id !== binding.repository_id
      || access.workspace.id !== binding.workspace_id) throw new Error('SLACK_DELIVERY_UNAUTHORIZED');
    return { connection, ...access };
  } catch (error) {
    if (error instanceof Error && /not found or access denied/.test(error.message)) throw new Error('SLACK_DELIVERY_UNAUTHORIZED', { cause: error });
    throw error;
  }
}
