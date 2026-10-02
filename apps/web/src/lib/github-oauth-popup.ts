export interface GitHubAuthorizationPopup {
  opener: unknown;
  location: { replace(url: string): void };
  close(): void;
}

/**
 * Opens a same-tab-origin blank window during the user's click gesture, then
 * navigates it once the server has produced the GitHub installation URL.
 */
export async function openGitHubAuthorizationPopup(
  loadAuthorizationUrl: () => Promise<string>,
  openPopup: () => GitHubAuthorizationPopup | null,
): Promise<void> {
  const popup = openPopup();
  if (!popup) throw new Error('GITHUB_POPUP_BLOCKED');

  // Drop the opener reference before any asynchronous work to prevent tab access.
  popup.opener = null;

  try {
    const url = await loadAuthorizationUrl();
    popup.location.replace(url);
  } catch (error) {
    popup.close();
    throw error;
  }
}
