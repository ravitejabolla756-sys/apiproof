import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CompatibilityChangeTypeSchema, CompatibilitySourceTypeSchema } from './compatibility.js';
import type { CompatibilitySourceType } from './compatibility.js';

/** Immutable input used to detect an official source update without retaining its body. */
export const OfficialSourceSnapshotSchema = z.strictObject({
  sourceUrl: z.url(),
  sourceType: CompatibilitySourceTypeSchema,
  fetchedAt: z.iso.date(),
  /** Exact fetched source text, before any candidate extraction or normalization. */
  content: z.string().min(1).max(5_000_000),
});
export type OfficialSourceSnapshot = z.infer<typeof OfficialSourceSnapshotSchema>;

/**
 * Contract for opt-in official-source integrations. Implementations own network
 * policy and may be supplied by a job, CLI, or fixture; this package performs
 * no fetch or scraping itself.
 */
export interface OfficialSourceAdapter {
  readonly id: string;
  readonly sourceTypes: readonly CompatibilitySourceType[];
  fetch(sourceUrl: string): Promise<OfficialSourceSnapshot>;
}

/**
 * Binds a source fingerprint to both its canonical URL and its exact source
 * body. URL fragments are presentation-only and must not create a new source.
 */
export function fingerprintOfficialSource(snapshot: OfficialSourceSnapshot): string {
  const parsed = OfficialSourceSnapshotSchema.parse(snapshot);
  const url = new URL(parsed.sourceUrl);
  url.hash = '';
  return createHash('sha256').update(url.toString()).update('\0').update(parsed.content).digest('hex');
}

export const CandidateChangeStateSchema = z.enum(['discovered', 'normalized', 'needs_review', 'reviewed', 'rejected']);
export type CandidateChangeState = z.infer<typeof CandidateChangeStateSchema>;

const CandidatePayloadSchema = z.strictObject({
  changeId: z.string().min(1).max(128).optional(), title: z.string().min(1).max(500),
  description: z.string().min(1).max(8_000), changeType: CompatibilityChangeTypeSchema.optional(),
  publishedAt: z.iso.date().optional(), effectiveAt: z.iso.date().optional(), removalAt: z.iso.date().optional(),
  affectedPackages: z.array(z.string().min(1)).max(50).optional(), affectedVersionRange: z.string().min(1).optional(),
  apiOperationPatterns: z.array(z.string().min(1)).max(30).optional(), affectedParameters: z.array(z.string().min(1)).max(30).optional(),
  affectedResponseFields: z.array(z.string().min(1)).max(30).optional(), affectedEndpoints: z.array(z.string().min(1)).max(30).optional(),
  affectedModels: z.array(z.string().min(1)).max(30).optional(),
  enumMetadata: z.strictObject({ name: z.string().min(1), removedValues: z.array(z.string().min(1)), addedValues: z.array(z.string().min(1)) }).optional(),
  apiVersionMetadata: z.strictObject({ version: z.string().min(1), replacement: z.string().optional() }).optional(),
  replacement: z.strictObject({ operation: z.string().optional(), parameter: z.string().optional(), endpoint: z.string().optional(), model: z.string().optional() }).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export const CandidateChangeSchema = z.strictObject({
  candidateId: z.string().min(1).max(128), providerId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  sourceUrl: z.url(), sourceType: CompatibilitySourceTypeSchema, sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  discoveredAt: z.iso.date(), state: CandidateChangeStateSchema, payload: CandidatePayloadSchema,
  auditTrail: z.array(z.strictObject({ state: CandidateChangeStateSchema, at: z.iso.date(), actor: z.string().min(1), note: z.string().min(1).max(2_000) })).min(1),
});
export type CandidateChange = z.infer<typeof CandidateChangeSchema>;

export const CandidateReviewSchema = z.strictObject({
  status: z.literal('reviewed'), reviewer: z.string().min(1), reviewerKind: z.enum(['human', 'agent']), reviewedAt: z.iso.date(), notes: z.string().min(1).max(2_000),
});
export type CandidateReview = z.infer<typeof CandidateReviewSchema>;
