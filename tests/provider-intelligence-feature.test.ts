import { describe, expect, it } from 'vitest';
import { providerIntelligenceV1Enabled } from '../apps/web/src/lib/server/provider-intelligence-feature.js';

describe('Provider Intelligence V1 server feature boundary', () => {
  it('defaults to the legacy path and is never client-controlled', () => {
    expect(providerIntelligenceV1Enabled({})).toBe(false);
    expect(providerIntelligenceV1Enabled({ PROVIDER_INTELLIGENCE_V1_ENABLED: 'false' })).toBe(false);
    expect(providerIntelligenceV1Enabled({ PROVIDER_INTELLIGENCE_V1_ENABLED: 'true' })).toBe(true);
    expect(providerIntelligenceV1Enabled({ PROVIDER_INTELLIGENCE_V1_ENABLED: 'TRUE' })).toBe(false);
    expect(providerIntelligenceV1Enabled({ PROVIDER_INTELLIGENCE_V1_ENABLED: '1' })).toBe(false);
    expect(providerIntelligenceV1Enabled({ PROVIDER_INTELLIGENCE_V1_ENABLED: 'yes' })).toBe(false);
  });
});
