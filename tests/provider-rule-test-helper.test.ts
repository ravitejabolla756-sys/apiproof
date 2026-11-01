import { describe, expect, it } from 'vitest';
import { collectProviderRuleTestTokens, findProviderRuleTestMatches } from '../apps/web/src/lib/server/provider-rule-test.js';

describe('provider rule review test helper', () => {
  it('includes operation and resource evidence while deduplicating and bounding tokens', () => {
    const tokens = collectProviderRuleTestTokens({
      apiOperationPatterns: ['files.upload', 'files.upload'],
      affectedResources: ['files'],
      authOrHeaderPatterns: ['X-Auth-User-Service-Key'],
      ignored: ['not included'],
    });
    expect(tokens).toEqual(['files.upload', 'files', 'X-Auth-User-Service-Key']);
  });

  it('matches literal tokens by source line without executing code', () => {
    const matches = findProviderRuleTestMatches(
      "client.files.upload();\nconst key = 'X-Auth-User-Service-Key';",
      ['files.upload', 'X-Auth-User-Service-Key'],
    );
    expect(matches).toEqual([
      { token: 'files.upload', line: 1, snippet: 'client.files.upload();' },
      { token: 'X-Auth-User-Service-Key', line: 2, snippet: "const key = 'X-Auth-User-Service-Key';" },
    ]);
  });
});
