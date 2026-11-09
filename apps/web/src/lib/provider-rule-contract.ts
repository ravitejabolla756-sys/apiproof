export type ProviderRuleCandidate = {
  id: string;
  providerId: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  payload: Record<string, unknown> | null;
  source: { url: string; type: string };
  createdAt: string;
  reviewNotes: string | null;
  coverage: {
    priority: 'P0' | 'P1' | 'P2';
    reviewBlockers: string[];
    evidenceClaims: number;
    hasExecutableTemplate: boolean;
    nextAction: 'human-review' | 'fixture-and-review' | 'already-reviewed';
  } | null;
  reviewPack: {
    source: { claims: Array<{ key: string; value: string }>; locator?: string; fingerprint: string };
    facts: string[];
    unknowns: string[];
    fixturePlan: { detectorTokens: string[]; requiredOutcomes: string[] };
    reviewChecklist: string[];
    template: { status: string; limitation: string };
    reviewOnlyTemplateProposal?: {
      templateId: string;
      mode: 'transform' | 'manual-guidance';
      limitation: string;
      transformation?: { kind: string };
      guidance?: { summary: string; steps: string[]; validation: string[] };
    };
  } | null;
};

export type ProviderRuleResponse = {
  candidates: ProviderRuleCandidate[];
  coverageSummary: {
    candidates: number;
    pendingCandidates: number;
    reviewedCandidates: number;
    reviewedProviders: number;
    providersMissingReviewedRules: string[];
    providersWithExecutableTemplates: string[];
  } | null;
};

export type ProviderRuleTestResponse = {
  matches: Array<{ token: string; line: number; snippet: string }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nullableText(value: unknown): value is string | null {
  return value === null || text(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function textArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

function parseReviewPack(value: unknown): ProviderRuleCandidate['reviewPack'] | null {
  if (value === null) return null;
  if (!record(value) || !record(value.source) || !Array.isArray(value.source.claims) || !text(value.source.fingerprint) || !textArray(value.facts) || !textArray(value.unknowns) || !record(value.fixturePlan) || !textArray(value.fixturePlan.detectorTokens) || !textArray(value.fixturePlan.requiredOutcomes) || !textArray(value.reviewChecklist) || !record(value.template) || !text(value.template.status) || !text(value.template.limitation)) return null;
  const claims = value.source.claims.map((claim) => record(claim) && text(claim.key) && text(claim.value) ? { key: claim.key, value: claim.value } : null);
  if (claims.some((claim) => claim === null) || (value.source.locator !== undefined && !text(value.source.locator))) return null;
  let proposal: NonNullable<ProviderRuleCandidate['reviewPack']>['reviewOnlyTemplateProposal'];
  if (value.reviewOnlyTemplateProposal !== undefined) {
    const raw = value.reviewOnlyTemplateProposal;
    if (!record(raw) || !text(raw.templateId) || (raw.mode !== 'transform' && raw.mode !== 'manual-guidance') || !text(raw.limitation)) return null;
    let transformation: { kind: string } | undefined;
    if (raw.transformation !== undefined) {
      if (!record(raw.transformation) || !text(raw.transformation.kind)) return null;
      transformation = { kind: raw.transformation.kind };
    }
    let guidance: { summary: string; steps: string[]; validation: string[] } | undefined;
    if (raw.guidance !== undefined) {
      if (!record(raw.guidance) || !text(raw.guidance.summary) || !textArray(raw.guidance.steps) || !textArray(raw.guidance.validation)) return null;
      guidance = { summary: raw.guidance.summary, steps: raw.guidance.steps, validation: raw.guidance.validation };
    }
    proposal = { templateId: raw.templateId, mode: raw.mode, limitation: raw.limitation, ...(transformation ? { transformation } : {}), ...(guidance ? { guidance } : {}) };
  }
  return {
    source: { claims: claims as Array<{ key: string; value: string }>, ...(value.source.locator ? { locator: value.source.locator } : {}), fingerprint: value.source.fingerprint },
    facts: value.facts, unknowns: value.unknowns,
    fixturePlan: { detectorTokens: value.fixturePlan.detectorTokens, requiredOutcomes: value.fixturePlan.requiredOutcomes },
    reviewChecklist: value.reviewChecklist, template: { status: value.template.status, limitation: value.template.limitation },
    ...(proposal ? { reviewOnlyTemplateProposal: proposal } : {}),
  };
}

function parseCandidate(value: unknown): ProviderRuleCandidate | null {
  if (!record(value) || !text(value.id) || !text(value.providerId) || !text(value.title) || !text(value.description) || !text(value.status) || !text(value.severity) || (value.payload !== null && !record(value.payload)) || !record(value.source) || !text(value.source.url) || !text(value.source.type) || !text(value.createdAt) || !nullableText(value.reviewNotes)) return null;
  let coverage: ProviderRuleCandidate['coverage'] = null;
  if (value.coverage !== null) {
    if (!record(value.coverage) || !['P0', 'P1', 'P2'].includes(String(value.coverage.priority)) || !textArray(value.coverage.reviewBlockers) || !count(value.coverage.evidenceClaims) || typeof value.coverage.hasExecutableTemplate !== 'boolean' || !['human-review', 'fixture-and-review', 'already-reviewed'].includes(String(value.coverage.nextAction))) return null;
    coverage = { priority: value.coverage.priority as 'P0' | 'P1' | 'P2', reviewBlockers: value.coverage.reviewBlockers, evidenceClaims: value.coverage.evidenceClaims, hasExecutableTemplate: value.coverage.hasExecutableTemplate, nextAction: value.coverage.nextAction as NonNullable<ProviderRuleCandidate['coverage']>['nextAction'] };
  }
  const reviewPack = parseReviewPack(value.reviewPack);
  if (value.reviewPack !== null && !reviewPack) return null;
  return { id: value.id, providerId: value.providerId, title: value.title, description: value.description, status: value.status, severity: value.severity, payload: value.payload as Record<string, unknown> | null, source: { url: value.source.url, type: value.source.type }, createdAt: value.createdAt, reviewNotes: value.reviewNotes, coverage, reviewPack };
}

/** Validate provider-rule review data before the interactive review UI renders it. */
export function parseProviderRuleResponse(value: unknown): ProviderRuleResponse | null {
  if (!record(value) || !Array.isArray(value.candidates)) return null;
  const ids = new Set<string>();
  const candidates = value.candidates.map(parseCandidate);
  for (const candidate of candidates) {
    if (!candidate || ids.has(candidate.id)) return null;
    ids.add(candidate.id);
  }
  let coverageSummary: ProviderRuleResponse['coverageSummary'] = null;
  if (value.coverageSummary !== undefined && value.coverageSummary !== null) {
    const summary = value.coverageSummary;
    if (!record(summary) || !count(summary.candidates) || !count(summary.pendingCandidates) || !count(summary.reviewedCandidates) || !count(summary.reviewedProviders) || !textArray(summary.providersMissingReviewedRules) || !textArray(summary.providersWithExecutableTemplates)) return null;
    coverageSummary = { candidates: summary.candidates, pendingCandidates: summary.pendingCandidates, reviewedCandidates: summary.reviewedCandidates, reviewedProviders: summary.reviewedProviders, providersMissingReviewedRules: summary.providersMissingReviewedRules, providersWithExecutableTemplates: summary.providersWithExecutableTemplates };
  }
  return { candidates: candidates as ProviderRuleCandidate[], coverageSummary };
}

/** Require the explicit success marker returned by review, edit and seed actions. */
export function parseProviderRuleActionResponse(value: unknown): boolean {
  return record(value) && value.ok === true;
}

/** Validate the structured sample-test result before displaying matches. */
export function parseProviderRuleTestResponse(value: unknown): ProviderRuleTestResponse | null {
  if (!record(value) || value.ok !== true || !Array.isArray(value.matches)) return null;
  const matches = value.matches.map((match) => {
    if (!record(match) || !text(match.token) || !count(match.line) || !text(match.snippet)) return null;
    return { token: match.token, line: match.line, snippet: match.snippet };
  });
  return matches.some((match) => match === null) ? null : { matches: matches as ProviderRuleTestResponse['matches'] };
}
