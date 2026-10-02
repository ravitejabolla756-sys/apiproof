/** True only after an already-loaded picker observes a real installation change. */
export function shouldReloadRepositoriesAfterStatusRefresh(
  hasLoadedRepositories: boolean,
  previousConnected: boolean | null,
  nextConnected: boolean,
): boolean {
  return hasLoadedRepositories && previousConnected !== null && previousConnected !== nextConnected;
}

/** A late network response must not update state after a newer request has started. */
export function isCurrentRepositoryRequest(requestId: number, currentRequestId: number): boolean {
  return requestId === currentRequestId;
}
