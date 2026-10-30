import { CandidateChangeSchema } from '@apiproof/shared';
import type { CandidateChange } from '@apiproof/shared';
import { compileCandidateChangeRegistry } from './change-ingestion-registry.js';

/** Stable, review-handoff format; it contains candidates only, never production records. */
export function exportCandidateBundle(candidates: readonly CandidateChange[]): string {
  const parsed = candidates.map((candidate) => CandidateChangeSchema.parse(candidate)).sort((a, b) => a.candidateId.localeCompare(b.candidateId, 'en'));
  return JSON.stringify({ schemaVersion: 1, candidates: parsed }, null, 2);
}

/** Imports and validates a local review bundle through the normal candidate registry. */
export function importCandidateBundle(serialized: string): ReturnType<typeof compileCandidateChangeRegistry> {
  let decoded: unknown;
  try { decoded = JSON.parse(serialized) as unknown; } catch { throw new Error('CANDIDATE_BUNDLE_INVALID_JSON'); }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('CANDIDATE_BUNDLE_INVALID_SCHEMA');
  const bundle = decoded as { schemaVersion?: unknown; candidates?: unknown };
  if (bundle.schemaVersion !== 1 || !Array.isArray(bundle.candidates)) throw new Error('CANDIDATE_BUNDLE_INVALID_SCHEMA');
  try { return compileCandidateChangeRegistry(bundle.candidates.map((candidate) => CandidateChangeSchema.parse(candidate))); }
  catch { throw new Error('CANDIDATE_BUNDLE_INVALID_SCHEMA'); }
}
