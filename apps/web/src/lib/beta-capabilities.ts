/**
 * Customer-visible capabilities for the currently supported public beta.
 *
 * Keep this separate from the dormant migration implementation: changing a
 * customer-facing capability requires an explicit release decision, rather
 * than inheriting a capability merely because supporting code exists.
 */
export const CURRENT_BETA_CAPABILITIES = Object.freeze({
  mode: 'detection_only' as const,
  reviewedProviderCount: 15,
  reviewedRuleCount: 20,
  migrationPlanningAvailable: false,
  draftPullRequestsAvailable: false,
});

export const DETECTION_ONLY_BETA_MESSAGE =
  'This beta detects reviewed compatibility changes and shows evidence. Migration planning and Draft Pull Request creation are not available yet.';

export const DETECTION_ONLY_BETA_SHORT_MESSAGE =
  'Detection-only beta: migration planning and Draft Pull Requests are not available yet.';
