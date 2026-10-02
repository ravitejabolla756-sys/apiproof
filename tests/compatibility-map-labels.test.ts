import { describe, expect, it } from 'vitest';
import { getPullRequestStateLabel, getRegistryCoverageDescription, getRegistryCoverageLabel } from '../apps/web/src/lib/compatibility-map-labels.js';

describe('Compatibility Map registry coverage wording', () => {
  it('labels registry review metadata without claiming a user reviewed the repository', () => {
    expect(getRegistryCoverageLabel(2)).toBe('Registry rules reviewed');
    expect(getRegistryCoverageLabel(0)).toBe('No registry-reviewed rules');
    expect(getRegistryCoverageDescription()).toContain('does not indicate that a user reviewed this repository');
  });

  it('uses the synchronized GitHub pull request lifecycle state in labels', () => {
    expect(getPullRequestStateLabel('draft')).toBe('Draft PR');
    expect(getPullRequestStateLabel('open')).toBe('Open · Ready for review');
    expect(getPullRequestStateLabel('closed')).toBe('Closed');
    expect(getPullRequestStateLabel('merged')).toBe('Merged');
    expect(getPullRequestStateLabel('unknown')).toBe('PR state unavailable');
  });
});
