import { createHash } from 'node:crypto';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, fingerprintCandidate } from '@apiproof/providers';
import type { CandidateChange } from '@apiproof/shared';
import { getDatabase } from './db/index.js';

export type ProviderReviewQueueSeedResult = {
  candidates: number;
  sources: number;
  entries: number;
  skippedExisting: number;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceId(sourceUrl: string): string {
  return `pcs_seed_${sha256(sourceUrl).slice(0, 32)}`;
}

function entryId(candidate: CandidateChange): string {
  return `pce_seed_${sha256(`${candidate.candidateId}:${candidate.documentFingerprint ?? candidate.sourceFingerprint}`).slice(0, 32)}`;
}

function databaseCandidateId(candidate: CandidateChange): string {
  return `prc_seed_${sha256(candidate.candidateId).slice(0, 32)}`;
}

/**
 * Materializes the reviewed-source catalog into the database review queue.
 *
 * This operation is intentionally evidence-only: it creates no approved rule,
 * no rescan job, and no workspace-scoped authorization. A human must still
 * review the candidate through the existing rule-review workflow.
 */
export async function seedOfficialProviderReviewQueue(now = new Date()): Promise<ProviderReviewQueueSeedResult> {
  const timestamp = now.toISOString();
  const db = getDatabase();
  const result: ProviderReviewQueueSeedResult = { candidates: 0, sources: 0, entries: 0, skippedExisting: 0 };

  await db.transaction(async (tx) => {
    for (const candidate of OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates) {
      const source = await tx.queryOne<{ id: string }>('SELECT id FROM provider_change_sources WHERE source_url = ?', [candidate.sourceUrl]);
      const currentSourceId = source?.id ?? sourceId(candidate.sourceUrl);
      if (!source) {
        await tx.execute(`
          INSERT INTO provider_change_sources
            (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'official-candidate-seed', ?, ?)
          ON CONFLICT (source_url) DO NOTHING
        `, [currentSourceId, candidate.providerId, candidate.sourceUrl, candidate.sourceType, timestamp, timestamp]);
        result.sources += 1;
      }

      const currentEntryId = entryId(candidate);
      await tx.execute(`
        INSERT INTO provider_changelog_entries
          (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (source_id, entry_key, content_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at
      `, [
        currentEntryId,
        currentSourceId,
        candidate.providerId,
        candidate.candidateId,
        candidate.payload.title,
        candidate.payload.description,
        candidate.sourceEvidence?.sourceLocator ?? candidate.sourceUrl,
        candidate.sourceUrl,
        candidate.documentFingerprint ?? candidate.sourceFingerprint,
        JSON.stringify({ candidate }),
        candidate.discoveredAt,
        timestamp,
      ]);
      result.entries += 1;

      const existing = await tx.queryOne<{ id: string }>(
        'SELECT id FROM provider_rule_candidates WHERE changelog_entry_id = ? AND provider_id = ?',
        [currentEntryId, candidate.providerId],
      );
      if (existing) {
        result.skippedExisting += 1;
        continue;
      }

      await tx.execute(`
        INSERT INTO provider_rule_candidates
          (id, changelog_entry_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'needs_review', ?, ?, ?, ?)
        ON CONFLICT (candidate_fingerprint) DO NOTHING
      `, [
        databaseCandidateId(candidate),
        currentEntryId,
        candidate.providerId,
        fingerprintCandidate(candidate),
        candidate.payload.severity ?? 'high',
        JSON.stringify(candidate.payload),
        timestamp,
        timestamp,
      ]);
      result.candidates += 1;
    }
  });

  return result;
}
