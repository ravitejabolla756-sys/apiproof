import { getDatabase } from './db/index.js';
import { PROVIDER_CHANGE_SOURCES } from './provider-change-monitor.js';

const SOURCE_FRESHNESS_WINDOW_MS = 6 * 60 * 60 * 1000;

export type ProviderSourceHealth = {
  providerId: string;
  sourceUrl: string;
  sourceType: string;
  adapterId: string;
  enabled: boolean;
  status: 'never-run' | 'healthy' | 'due' | 'failing' | 'disabled';
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  nextAttemptAt: string | null;
  failureCount: number;
  lastErrorCode: string | null;
  parserStatus: 'structured' | 'review-only' | 'not-run';
};

type SourceHealthRow = {
  provider_id: string;
  enabled: number | boolean;
  last_fetched_at: string | null;
  last_success_at: string | null;
  next_attempt_at: string | null;
  failure_count: number;
  last_error_code: string | null;
};

type ParserRow = { provider_id: string; evidence_json: string };

/** Returns operational source state without inferring scanner capability. */
export async function getProviderSourceHealth(now = new Date()): Promise<ProviderSourceHealth[]> {
  const rows = await getDatabase().query<SourceHealthRow>(`
    SELECT provider_id, enabled, last_fetched_at, last_success_at,
           next_attempt_at, failure_count, last_error_code
    FROM provider_change_sources
  `);
  const parserRows = await getDatabase().query<ParserRow>(`
    SELECT provider_id, evidence_json
    FROM provider_changelog_entries
    ORDER BY last_seen_at DESC
  `);
  const parserByProvider = new Map<string, ProviderSourceHealth['parserStatus']>();
  const evidenceOnlyFallbackByProvider = new Map<string, ProviderSourceHealth['parserStatus']>();
  for (const row of parserRows) {
    try {
      const evidence = JSON.parse(row.evidence_json) as { parserStatus?: unknown };
      if (evidence.parserStatus === 'structured' || evidence.parserStatus === 'review-only') {
        // Monitor-produced entries are authoritative. Seeded official
        // candidates intentionally omit parserStatus because they are
        // evidence-only queue records, not proof that the source was parsed.
        if (!parserByProvider.has(row.provider_id)) parserByProvider.set(row.provider_id, evidence.parserStatus);
      } else if (!evidenceOnlyFallbackByProvider.has(row.provider_id)) {
        evidenceOnlyFallbackByProvider.set(row.provider_id, 'review-only');
      }
    } catch {
      if (!evidenceOnlyFallbackByProvider.has(row.provider_id)) evidenceOnlyFallbackByProvider.set(row.provider_id, 'review-only');
    }
  }
  const byProvider = new Map(rows.map((row) => [row.provider_id, row]));
  return PROVIDER_CHANGE_SOURCES.map((source) => {
    const row = byProvider.get(source.providerId);
    const enabled = row ? Boolean(row.enabled) : true;
    const lastSuccessTimestamp = row?.last_success_at ? Date.parse(row.last_success_at) : Number.NaN;
    const successIsFresh = Number.isFinite(lastSuccessTimestamp)
      && now.getTime() >= lastSuccessTimestamp
      && now.getTime() - lastSuccessTimestamp <= SOURCE_FRESHNESS_WINDOW_MS;
    const status: ProviderSourceHealth['status'] = !enabled
      ? 'disabled'
      : !row?.last_success_at
        ? 'never-run'
        : (row.failure_count ?? 0) > 0
          ? 'failing'
          : !successIsFresh || (row.next_attempt_at && row.next_attempt_at <= now.toISOString())
            ? 'due'
            : 'healthy';
    return {
      providerId: source.providerId,
      sourceUrl: source.sourceUrl,
      sourceType: source.sourceType,
      adapterId: source.adapterId,
      enabled,
      status,
      lastFetchedAt: row?.last_fetched_at ?? null,
      lastSuccessAt: row?.last_success_at ?? null,
      nextAttemptAt: row?.next_attempt_at ?? null,
      failureCount: row?.failure_count ?? 0,
      lastErrorCode: row?.last_error_code ?? null,
      parserStatus: parserByProvider.get(source.providerId) ?? evidenceOnlyFallbackByProvider.get(source.providerId) ?? 'not-run',
    };
  });
}
