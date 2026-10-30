import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileProductionChangeRegistry, loadStripeRegistry, loadTwilioRegistry, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import crypto from 'node:crypto';
import { ApiChangeSchema, PatchRuleSchema, ReviewedCompatibilityChangeSchema } from '@apiproof/shared';
import type { ApiChange, PatchRule, ReviewedCompatibilityChange } from '@apiproof/shared';
import { getDatabase } from './db/index.js';

export function resolveRegistryDirectory(providerName: 'stripe' | 'twilio'): string {
  const candidates = [
    path.resolve(process.cwd(), 'registry', providerName),
    path.resolve(process.cwd(), '../../registry', providerName),
    path.resolve(process.cwd(), '..', '..', 'registry', providerName),
    fileURLToPath(new URL(`../../../../../registry/${providerName}`, import.meta.url)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(`Registry directory for provider '${providerName}' could not be located in candidate paths: ${candidates.join(', ')}`);
}

function symbolPath(value: string): string | undefined {
  const normalized = value.trim().replace(/^[^A-Za-z_$]+/, '').replace(/[^A-Za-z0-9_$]+/g, '.');
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(normalized) ? normalized : undefined;
}

function reviewedChangeToPlanningChange(change: ReviewedCompatibilityChange): ApiChange {
  const methodSymbols = change.apiOperationPatterns.map(symbolPath).filter((value): value is string => Boolean(value));
  const resourceSymbols = [...change.affectedResources, ...change.affectedModels, ...change.affectedEndpoints]
    .map(symbolPath).filter((value): value is string => Boolean(value));
  const symbols = [...new Set([...methodSymbols, ...resourceSymbols])];
  const fallbackSymbol = symbolPath(change.providerId) ?? 'provider';
  const changeType: ApiChange['changeType'] = change.changeType === 'parameter_removed' || change.changeType === 'parameter_required'
    ? 'parameter-removed'
    : change.changeType === 'parameter_renamed' ? 'parameter-renamed'
      : change.changeType === 'method_removed' ? 'method-removed'
        : change.changeType === 'method_renamed' ? 'method-renamed'
          : change.changeType === 'endpoint_removed' ? 'resource-removed'
            : change.changeType === 'model_retired' ? 'type-changed'
              : change.changeType === 'response_field_removed' ? 'response-field-changed'
                : 'symbol-deprecated';
  const affectedSymbols = (symbols.length ? symbols : [fallbackSymbol]).map((symbol) => ({
    symbol,
    match: 'exact' as const,
    kind: methodSymbols.includes(symbol) ? 'method' as const : 'resource' as const,
  }));
  const rules = changeType === 'response-field-changed'
    ? affectedSymbols.map((item) => ({ kind: 'response-field' as const, methods: item.kind === 'method' ? [item.symbol] : [], types: item.kind === 'resource' ? [item.symbol] : [], path: change.affectedResponseFields[0] ?? 'response' }))
    : affectedSymbols.map((item) => ({ kind: item.kind, symbol: item.symbol, match: item.match,
      ...(item.kind === 'method' && change.replacement?.operation && symbolPath(change.replacement.operation)
        ? { replacementSymbol: symbolPath(change.replacement.operation) }
        : {}) }));
  const packageName = change.affectedPackages?.[0] ?? change.providerId;
  const instructions = [
    change.description,
    ...(change.replacement?.operation ? [`Replace the affected operation with ${change.replacement.operation}.`] : []),
    ...(change.replacement?.parameter ? [`Replace the affected parameter with ${change.replacement.parameter}.`] : []),
    ...(change.replacement?.endpoint ? [`Use replacement endpoint ${change.replacement.endpoint}.`] : []),
    ...(change.apiVersionMetadata?.replacement ? [`Migrate API version to ${change.apiVersionMetadata.replacement}.`] : []),
  ];
  return ApiChangeSchema.parse({
    provider: change.providerId,
    id: change.changeId,
    title: change.title,
    description: change.description,
    packageName,
    affectedSymbols,
    oldBehavior: change.description,
    newBehavior: change.replacement ? `Use the reviewed replacement: ${JSON.stringify(change.replacement)}.` : 'Follow the reviewed provider migration guidance.',
    migrationInstructions: [...new Set(instructions)].slice(0, 50),
    sourceUrl: change.officialSourceUrl,
    severity: change.severity,
    ...(change.affectedVersionRange ? { affectedSdkVersions: change.affectedVersionRange } : {}),
    ...(change.apiVersionMetadata?.version ? { apiVersion: change.apiVersionMetadata.version } : {}),
    ...(change.effectiveAt ? { effectiveDate: change.effectiveAt } : {}),
    provenance: 'official',
    changeType,
    ...([...new Set([...change.affectedResources, ...change.affectedEndpoints].map(symbolPath).filter((value): value is string => Boolean(value)))].length
      ? { resources: [...new Set([...change.affectedResources, ...change.affectedEndpoints].map(symbolPath).filter((value): value is string => Boolean(value)))].slice(0, 30) }
      : {}),
    rules,
    evidenceSources: change.evidence.map((source) => ({ url: source.url, summary: source.summary, accessedAt: source.accessedAt })),
    review: { status: change.review.status, reviewer: change.review.reviewer, reviewerKind: 'human', reviewedAt: change.review.reviewedAt, notes: change.review.notes ?? 'Approved provider compatibility change.' },
    versionScope: change.affectedVersionRange || change.apiVersionMetadata ? 'api-and-sdk' : 'sdk',
    assumptions: ['Planning uses the human-reviewed provider compatibility record as its source of truth.'],
  });
}

export async function loadProviderRegistry(providerName: string, workspaceId?: string): Promise<ApiChange[]> {
  const legacy = providerName === 'stripe' || providerName === 'twilio'
    ? await (async () => {
      const dir = resolveRegistryDirectory(providerName);
      return providerName === 'twilio' ? loadTwilioRegistry(dir) : loadStripeRegistry(dir);
    })()
    : [];
  // The legacy adapters validate the historical RegistryChange shape. The
  // normalized production registry is consumed by productization and cannot
  // be passed back through those adapters without losing scope metadata (or
  // being rejected as an invalid legacy record).
  const active = await loadActiveProductionRegistry(workspaceId);
  const dynamic = active.changes
    .filter((change) => change.providerId === providerName && !legacy.some((entry) => entry.id === change.changeId))
    .map(reviewedChangeToPlanningChange);
  return [...legacy, ...dynamic];
}

type ApprovedRuleRow = {
  provider_id: string;
  workspace_id: string | null;
  payload_json: string;
  source_url: string;
  source_type: string;
  reviewed_by: string;
  reviewed_at: string;
  review_notes: string;
};

/**
 * Resolves an executable rule only from an approved workspace candidate. The
 * stored template is intentionally digest-less; the digest is rebound to the
 * exact reviewed change loaded from the same workspace before core patching.
 */
export async function loadApprovedDynamicPatchRule(providerId: string, changeId: string, workspaceId: string): Promise<PatchRule | undefined> {
  const db = getDatabase();
  const rows = await db.query<{ payload_json: string; source_url: string }>(`
    SELECT c.payload_json, e.source_url
    FROM provider_rule_candidates c
    JOIN provider_changelog_entries e ON e.id = c.changelog_entry_id
    WHERE c.status = 'approved' AND c.provider_id = ?
      AND (c.workspace_id IS NULL OR c.workspace_id = ?)
    ORDER BY c.reviewed_at ASC, c.id ASC
  `, [providerId, workspaceId]);
  const registry = await loadActiveProductionRegistry(workspaceId);
  const reviewedChange = registry.byChangeId.get(changeId);
  if (!reviewedChange) return undefined;
  const change = reviewedChangeToPlanningChange(reviewedChange);
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload_json) as { changeId?: unknown; migrationTemplate?: unknown };
      if (payload.changeId !== changeId || !payload.migrationTemplate) continue;
      const template = PatchRuleSchema.omit({ changeDigest: true }).parse(payload.migrationTemplate);
      if (!template.sources.includes(row.source_url)) continue;
      return PatchRuleSchema.parse({ ...template, changeDigest: crypto.createHash('sha256').update(JSON.stringify(change)).digest('hex') });
    } catch {
      // Invalid or stale templates remain review data and cannot authorize a patch.
    }
  }
  return undefined;
}

/**
 * Dynamic database-backed rules are a separate capability from bundled rules.
 * Callers use this distinction to keep approved-but-untemplated findings
 * review-only instead of silently falling back to an unrelated patch rule.
 */
export async function isApprovedDynamicProductionChange(providerId: string, changeId: string, workspaceId: string): Promise<boolean> {
  if (PRODUCTION_COMPATIBILITY_REGISTRY.changes.some((change) => change.providerId === providerId && change.changeId === changeId)) return false;
  const registry = await loadActiveProductionRegistry(workspaceId);
  return registry.changes.some((change) => change.providerId === providerId && change.changeId === changeId);
}

function normalizeReviewDate(value: string): string | undefined {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

/**
 * Merges explicit database approvals with the immutable reviewed source
 * registry. Invalid or incomplete records are ignored and remain visible as
 * review data rather than becoming scanner decisions.
 */
export async function loadActiveProductionRegistry(workspaceId?: string): Promise<ReturnType<typeof compileProductionChangeRegistry>> {
  const db = getDatabase();
  const workspaceClause = workspaceId ? 'AND (c.workspace_id IS NULL OR c.workspace_id = ?)' : '';
  const rows = await db.query<ApprovedRuleRow>(`
    SELECT c.provider_id, c.workspace_id, c.payload_json, e.source_url, s.source_type,
           c.reviewed_by, c.reviewed_at, COALESCE(c.review_notes, '') AS review_notes
    FROM provider_rule_candidates c
    JOIN provider_changelog_entries e ON e.id = c.changelog_entry_id
    JOIN provider_change_sources s ON s.id = e.source_id
    WHERE c.status = 'approved'
      ${workspaceClause}
    ORDER BY c.reviewed_at ASC, c.id ASC
  `, workspaceId ? [workspaceId] : []);
  const dynamic: ReviewedCompatibilityChange[] = [];
  const existingIds = new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId));
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      const reviewedDate = normalizeReviewDate(row.reviewed_at);
      if (!reviewedDate) continue;
      const changeId = typeof payload.changeId === 'string' ? payload.changeId : `db-${row.provider_id}-${row.reviewed_at}`;
      if (existingIds.has(changeId)) continue;
      const candidate = ReviewedCompatibilityChangeSchema.parse({
        providerId: row.provider_id,
        changeId,
        title: payload.title,
        description: payload.description,
        changeType: payload.changeType,
        publishedAt: payload.publishedAt,
        effectiveAt: payload.effectiveAt,
        removalAt: payload.removalAt,
        officialSourceUrl: row.source_url,
        sourceType: row.source_type,
        applicabilityScope: payload.applicabilityScope,
        affectedPackages: payload.affectedPackages,
        affectedVersionRange: payload.affectedVersionRange,
        apiOperationPatterns: payload.apiOperationPatterns ?? [],
        affectedParameters: payload.affectedParameters ?? [],
        parameterConditions: payload.parameterConditions,
        affectedResponseFields: payload.affectedResponseFields ?? [],
        affectedEndpoints: payload.affectedEndpoints ?? [],
        affectedDomains: payload.affectedDomains ?? [],
        affectedModels: payload.affectedModels ?? [],
        affectedResources: payload.affectedResources ?? [],
        authOrHeaderPatterns: payload.authOrHeaderPatterns ?? [],
        enumMetadata: payload.enumMetadata,
        apiVersionMetadata: payload.apiVersionMetadata,
        replacement: payload.replacement,
        severity: payload.severity,
        review: { status: 'reviewed', reviewer: row.reviewed_by, reviewedAt: reviewedDate, provenance: 'official', ...(row.review_notes ? { notes: row.review_notes } : {}) },
        evidence: [{ url: row.source_url, summary: typeof payload.description === 'string' ? payload.description.slice(0, 2_000) : 'Reviewed official provider source.', accessedAt: reviewedDate }],
      });
      dynamic.push(candidate);
      existingIds.add(changeId);
    } catch {
      // A malformed or stale approval is never allowed to affect scanning.
    }
  }
  return compileProductionChangeRegistry([...PRODUCTION_COMPATIBILITY_REGISTRY.changes, ...dynamic]);
}
