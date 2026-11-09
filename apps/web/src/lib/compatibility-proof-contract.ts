export type ReviewedChangeProjection = {
  providerId: string;
  changeId: string;
  title: string;
  changeType: string;
  officialSourceUrl: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  removalAt: string | null;
  severity: string;
  applicabilityScope: { dimensions: string[] };
  affectedModels: string[];
  affectedResources: string[];
  affectedResponseFields: string[];
  affectedEndpoints: string[];
  affectedDomains: string[];
  authOrHeaderPatterns: string[];
  affectedParameters: string[];
  replacement?: { model?: string; endpoint?: string; domain?: string; authOrHeader?: string; parameter?: string; resources?: string[] } | null;
  reviewer: string;
  reviewedAt: string;
};

export type CompatibilityProofProjection = { claimsAvailable: boolean; reason: string | null; changes: ReviewedChangeProjection[] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function textList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => text(item) !== null);
}

function replacement(value: unknown): ReviewedChangeProjection['replacement'] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!record(value)) return null;
  const keys = ['model', 'endpoint', 'domain', 'authOrHeader', 'parameter'] as const;
  if (!keys.every((key) => value[key] === undefined || text(value[key]) !== null) || (value.resources !== undefined && !textList(value.resources))) return null;
  return {
    ...(value.model === undefined ? {} : { model: text(value.model)! }),
    ...(value.endpoint === undefined ? {} : { endpoint: text(value.endpoint)! }),
    ...(value.domain === undefined ? {} : { domain: text(value.domain)! }),
    ...(value.authOrHeader === undefined ? {} : { authOrHeader: text(value.authOrHeader)! }),
    ...(value.parameter === undefined ? {} : { parameter: text(value.parameter)! }),
    ...(value.resources === undefined ? {} : { resources: value.resources as string[] }),
  };
}

/** Validate reviewed compatibility-proof records before rendering authoritative claims. */
export function parseCompatibilityProofResponse(value: unknown): CompatibilityProofProjection | null {
  if (!record(value) || typeof value.claimsAvailable !== 'boolean' || (value.reason !== null && typeof value.reason !== 'string') || !Array.isArray(value.changes)) return null;
  const seen = new Set<string>();
  const changes: ReviewedChangeProjection[] = [];
  for (const item of value.changes) {
    if (!record(item)) return null;
    const providerId = text(item.providerId); const changeId = text(item.changeId); const title = text(item.title); const changeType = text(item.changeType);
    const severity = text(item.severity); const reviewer = text(item.reviewer); const reviewedAt = text(item.reviewedAt);
    const scope = item.applicabilityScope;
    const arrays = ['affectedModels', 'affectedResources', 'affectedResponseFields', 'affectedEndpoints', 'affectedDomains', 'authOrHeaderPatterns', 'affectedParameters'] as const;
    if (!providerId || !changeId || !title || !changeType || typeof item.officialSourceUrl !== 'string' || !severity || !reviewer || !reviewedAt || !record(scope)
      || !textList(scope.dimensions) || !arrays.every((key) => textList(item[key])) || seen.has(changeId)) return null;
    const parsedReplacement = replacement(item.replacement);
    if (item.replacement !== undefined && parsedReplacement === null && item.replacement !== null) return null;
    seen.add(changeId);
    changes.push({ providerId, changeId, title, changeType, officialSourceUrl: item.officialSourceUrl.trim(), publishedAt: optionalText(item.publishedAt), effectiveAt: optionalText(item.effectiveAt), removalAt: optionalText(item.removalAt), severity, applicabilityScope: { dimensions: (scope.dimensions as string[]).map((dimension) => dimension.trim()) }, affectedModels: (item.affectedModels as string[]).map((entry) => entry.trim()), affectedResources: (item.affectedResources as string[]).map((entry) => entry.trim()), affectedResponseFields: (item.affectedResponseFields as string[]).map((entry) => entry.trim()), affectedEndpoints: (item.affectedEndpoints as string[]).map((entry) => entry.trim()), affectedDomains: (item.affectedDomains as string[]).map((entry) => entry.trim()), authOrHeaderPatterns: (item.authOrHeaderPatterns as string[]).map((entry) => entry.trim()), affectedParameters: (item.affectedParameters as string[]).map((entry) => entry.trim()), ...(parsedReplacement === undefined ? {} : { replacement: parsedReplacement }), reviewer, reviewedAt });
  }
  return { claimsAvailable: value.claimsAvailable, reason: optionalText(value.reason), changes };
}
