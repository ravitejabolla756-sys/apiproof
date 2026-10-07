import { describe, expect, it } from 'vitest';
import { getProofMatchedTarget, getPullRequestStateLabel, getRegistryCoverageDescription, getRegistryCoverageLabel } from '../apps/web/src/lib/compatibility-map-labels.js';

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

  it('renders every generic compatibility target dimension without provider-specific branches', () => {
    expect(getProofMatchedTarget({ matchedResource: 'Assistants API' })).toBe('Assistants API');
    expect(getProofMatchedTarget({ matchedDomain: 'api.ie1.twilio.com' })).toBe('api.ie1.twilio.com');
    expect(getProofMatchedTarget({ matchedResponseField: 'secret_scanning_enabled_for_new_repositories' })).toContain('secret_scanning');
    expect(getProofMatchedTarget({ matchedAuthOrHeader: 'anon key' })).toBe('anon key');
    expect(getProofMatchedTarget({})).toBe('No exact target match');
  });
});
