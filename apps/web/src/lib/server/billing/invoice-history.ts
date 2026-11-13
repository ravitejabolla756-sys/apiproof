import { unavailableInvoiceHistoryAdapter, type InvoiceHistoryResult } from '../../invoice-history-contract.js';
import { assertWorkspaceCapability } from '../workspace-policy.js';
import { requireWorkspaceMember } from '../workspace-service.js';

/**
 * Backend-owned invoice boundary. Provider retrieval is intentionally not
 * implemented until BillingProvider exposes an approved invoice projection.
 * Authorization still happens here so callers cannot bypass workspace scope.
 */
export async function getAuthorizedWorkspaceInvoiceHistory(
  userId: string,
  requestedWorkspaceId: string,
): Promise<InvoiceHistoryResult> {
  if (!requestedWorkspaceId.trim()) throw new Error('WORKSPACE_ID_REQUIRED');
  const workspace = await requireWorkspaceMember(userId, requestedWorkspaceId);
  assertWorkspaceCapability(workspace.role, 'billing:manage');
  return unavailableInvoiceHistoryAdapter.load();
}
