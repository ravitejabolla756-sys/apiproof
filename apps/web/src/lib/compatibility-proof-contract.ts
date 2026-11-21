export type CompatibilityReplacement = {
  model?: string;
  endpoint?: string;
  domain?: string;
  authOrHeader?: string;
  parameter?: string;
  resources?: string[];
};

export type ReviewedCompatibilityChange = {
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
  replacement: CompatibilityReplacement | null;
  reviewer: string;
  reviewedAt: string;
};

export type CompatibilityProofResponse = {
  claimsAvailable: boolean;
  reason: 'NO_REVIEWED_PRODUCTION_CHANGES' | null;
  changes: ReviewedCompatibilityChange[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function list(value: unknown, limit = 128): string[] | null {
  if (!Array.isArray(value) || value.length > limit || !value.every((item) => text(item))) return null;
  return value.map((item) => text(item)!);
}

function nullableDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return text(value) ?? undefined;
}

function safeHttpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseReplacement(value: unknown): CompatibilityReplacement | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const replacement: CompatibilityReplacement = {};
  for (const key of ['model', 'endpoint', 'domain', 'authOrHeader', 'parameter'] as const) {
    if (value[key] !== undefined) {
      const parsed = text(value[key]);
      if (!parsed) return undefined;
      replacement[key] = parsed;
    }
  }
  if (value.resources !== undefined) {
    const resources = list(value.resources);
    if (!resources) return undefined;
    replacement.resources = resources;
  }
  return replacement;
}

function parseChange(value: unknown): ReviewedCompatibilityChange | null {
  if (!isRecord(value)) return null;
  const providerId = text(value.providerId);
  const changeId = text(value.changeId);
  const title = text(value.title);
  const changeType = text(value.changeType);
  const officialSourceUrl = safeHttpsUrl(value.officialSourceUrl);
  const severity = text(value.severity);
  const reviewer = text(value.reviewer);
  const reviewedAt = text(value.reviewedAt);
  const scope = isRecord(value.applicabilityScope) ? list(value.applicabilityScope.dimensions, 32) : null;
  const publishedAt = nullableDate(value.publishedAt);
  const effectiveAt = nullableDate(value.effectiveAt);
  const removalAt = nullableDate(value.removalAt);
  const affectedModels = list(value.affectedModels);
  const affectedResources = list(value.affectedResources);
  const affectedResponseFields = list(value.affectedResponseFields);
  const affectedEndpoints = list(value.affectedEndpoints);
  const affectedDomains = list(value.affectedDomains);
  const authOrHeaderPatterns = list(value.authOrHeaderPatterns);
  const affectedParameters = list(value.affectedParameters);
  const replacement = parseReplacement(value.replacement);
  if (!providerId || !changeId || !title || !changeType || !officialSourceUrl || !severity || !reviewer || !reviewedAt
    || !scope || publishedAt === undefined || effectiveAt === undefined || removalAt === undefined
    || !affectedModels || !affectedResources || !affectedResponseFields || !affectedEndpoints || !affectedDomains
    || !authOrHeaderPatterns || !affectedParameters || replacement === undefined) return null;
  return { providerId, changeId, title, changeType, officialSourceUrl, publishedAt, effectiveAt, removalAt, severity,
    applicabilityScope: { dimensions: scope }, affectedModels, affectedResources, affectedResponseFields, affectedEndpoints,
    affectedDomains, authOrHeaderPatterns, affectedParameters, replacement, reviewer, reviewedAt };
}

export function parseCompatibilityProofResponse(value: unknown): CompatibilityProofResponse | null {
  if (!isRecord(value) || typeof value.claimsAvailable !== 'boolean' || !Array.isArray(value.changes) || value.changes.length > 500) return null;
  const changes = value.changes.map(parseChange);
  if (changes.some((change) => !change)) return null;
  const reason = value.reason === null ? null : value.reason === 'NO_REVIEWED_PRODUCTION_CHANGES' ? value.reason : undefined;
  if (reason === undefined || (value.claimsAvailable !== (changes.length > 0))) return null;
  const seen = new Set<string>();
  for (const change of changes) {
    if (seen.has(change!.changeId)) return null;
    seen.add(change!.changeId);
  }
  return { claimsAvailable: value.claimsAvailable, reason, changes: changes as ReviewedCompatibilityChange[] };
}
