import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReleaseManifest } from '../apps/web/scripts/release-manifest.js';

describe('release manifest', () => {
  it('reports release identity and safety inventory without secrets', () => {
    const manifest = buildReleaseManifest(path.resolve(import.meta.dirname, '..'));

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.git.commit).toMatch(/^[a-f0-9]{40}$/i);
    expect(manifest.providerRegistryDigest).toMatch(/^[a-f0-9]{64}$/i);
    expect(manifest.inventory.monitoredProviders).toBe(19);
    expect(manifest.inventory.discoveryProviders).toBeGreaterThanOrEqual(19);
    expect(manifest.inventory.officialCandidates).toBeGreaterThanOrEqual(50);
    expect(manifest.inventory.reviewedRules).toBeGreaterThanOrEqual(50);
    expect(manifest.cron.changelogMonitor).toBe('0 */6 * * *');
    expect(manifest.cron.scheduledRescan).toBe('0 2 * * *');
    expect(JSON.stringify(manifest)).not.toMatch(/postgres|private.key|secret|token/i);
  });
});
