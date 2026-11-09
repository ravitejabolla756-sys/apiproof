import { describe, expect, it } from 'vitest';
import { isOverviewResponse } from '../apps/web/src/lib/overview-contract.js';

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
});
