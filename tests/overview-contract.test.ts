import { describe, expect, it } from 'vitest';
import { isOverviewResponse, parseOverviewSidebarProjection } from '../apps/web/src/lib/overview-contract.js';

const stats = {
  connectedRepositories: 0, scansCompleted: 0, openFindings: 0, criticalFindings: 0, draftPrsCount: 0,
  providerRulesPending: 0, providerRulesApproved: 0, rescansPending: 0, rescansProcessing: 0, rescansFailed: 0,
};

describe('overview response envelope', () => {
  it('accepts the canonical collection envelope', () => {
    expect(isOverviewResponse({ stats, repositories: [], recentActivities: [], recentProviderChanges: [], findingsThisWeek: [], recentFixes: [] })).toBe(true);
  });

  it('rejects missing collections and unsafe counters', () => {
    expect(isOverviewResponse({ stats, repositories: [], recentActivities: [], recentProviderChanges: [], findingsThisWeek: [] })).toBe(false);
    expect(isOverviewResponse({ stats: { ...stats, openFindings: -1 }, repositories: [], recentActivities: [], recentProviderChanges: [], findingsThisWeek: [], recentFixes: [] })).toBe(false);
  });

  it('guards the sidebar projection independently of the full collection envelope', () => {
    expect(parseOverviewSidebarProjection({ stats: { openFindings: 4 }, workspace: { name: ' Primary ' }, user: { email: ' owner@example.test ' } })).toEqual({ openFindingsCount: 4, workspaceName: 'Primary', userEmail: 'owner@example.test' });
    expect(parseOverviewSidebarProjection({ stats: { openFindings: -1 }, workspace: { name: 'Primary' } })).toEqual({ openFindingsCount: null, workspaceName: 'Primary', userEmail: null });
    expect(parseOverviewSidebarProjection({ stats: { openFindings: 4 }, workspace: { name: 7 } })).toBeNull();
  });
});
