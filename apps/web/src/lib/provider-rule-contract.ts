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

export type ProviderRuleCoverageSummary = {
  candidates: number;
  pendingCandidates: number;
  reviewedCandidates: number;
  reviewedProviders: number;
  providersMissingReviewedRules: string[];
  providersWithExecutableTemplates: string[];
};

export type ProviderRuleTestMatch = { token: string; line: number; snippet: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = 4096): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function nullableText(value: unknown, max = 4096): string | null {
  return value === null ? null : text(value, max);
}

function stringList(value: unknown, maxItems = 256, maxItemLength = 1024): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = value.map((item) => text(item, maxItemLength));
  return result.every((item): item is string => item !== null) ? result : null;
}

function parseCoverage(value: unknown): ProviderRuleCandidate['coverage'] {
  if (value === null) return null;
  if (!record(value)) return null;
  const priority = value.priority === 'P0' || value.priority === 'P1' || value.priority === 'P2' ? value.priority : null;
  const nextAction = value.nextAction === 'human-review' || value.nextAction === 'fixture-and-review' || value.nextAction === 'already-reviewed' ? value.nextAction : null;
  const reviewBlockers = stringList(value.reviewBlockers, 32);
  if (!priority || !nextAction || !reviewBlockers || !Number.isSafeInteger(value.evidenceClaims) || Number(value.evidenceClaims) < 0 || typeof value.hasExecutableTemplate !== 'boolean') return null;
  return { priority, reviewBlockers, evidenceClaims: Number(value.evidenceClaims), hasExecutableTemplate: value.hasExecutableTemplate, nextAction };
}

function parseReviewPack(value: unknown): ProviderRuleCandidate['reviewPack'] {
  if (value === null) return null;
  if (!record(value) || !record(value.source) || !record(value.fixturePlan) || !record(value.template)) return null;
  const claims = Array.isArray(value.source.claims) && value.source.claims.length <= 256
    ? value.source.claims.map((claim) => record(claim) && text(claim.key, 256) && text(claim.value, 2048) ? { key: text(claim.key, 256)!, value: text(claim.value, 2048)! } : null)
    : null;
  const facts = stringList(value.facts); const unknowns = stringList(value.unknowns);
  const detectorTokens = stringList(value.fixturePlan.detectorTokens); const requiredOutcomes = stringList(value.fixturePlan.requiredOutcomes);
  const reviewChecklist = stringList(value.reviewChecklist);
  const fingerprint = text(value.source.fingerprint, 256); const status = text(value.template.status, 256); const limitation = text(value.template.limitation, 2048);
  if (!claims || claims.some((claim) => !claim) || !facts || !unknowns || !detectorTokens || !requiredOutcomes || !reviewChecklist || !fingerprint || !status || !limitation) return null;
  let reviewOnlyTemplateProposal: NonNullable<ProviderRuleCandidate['reviewPack']>['reviewOnlyTemplateProposal'];
  if (value.reviewOnlyTemplateProposal !== undefined) {
    if (!record(value.reviewOnlyTemplateProposal)) return null;
    const proposal = value.reviewOnlyTemplateProposal;
    const templateId = text(proposal.templateId, 256);
    const mode = proposal.mode === 'transform' || proposal.mode === 'manual-guidance' ? proposal.mode : null;
    const proposalLimitation = text(proposal.limitation, 2048);
    if (!templateId || !mode || !proposalLimitation) return null;
    let transformation: { kind: string } | undefined;
    if (proposal.transformation !== undefined) {
      if (!record(proposal.transformation) || !text(proposal.transformation.kind, 256)) return null;
      transformation = { kind: text(proposal.transformation.kind, 256)! };
    }
    let guidance: { summary: string; steps: string[]; validation: string[] } | undefined;
    if (proposal.guidance !== undefined) {
      if (!record(proposal.guidance)) return null;
      const summary = text(proposal.guidance.summary, 2048);
      const steps = stringList(proposal.guidance.steps, 64, 2048);
      const validation = stringList(proposal.guidance.validation, 64, 2048);
      if (!summary || !steps || !validation) return null;
      guidance = { summary, steps, validation };
    }
    if (mode === 'transform' && !transformation || mode === 'manual-guidance' && !guidance) return null;
    reviewOnlyTemplateProposal = { templateId, mode, limitation: proposalLimitation, ...(transformation ? { transformation } : {}), ...(guidance ? { guidance } : {}) };
  }
  return {
    source: { claims: claims as Array<{ key: string; value: string }>, ...(value.source.locator === undefined ? {} : { locator: text(value.source.locator, 1024) ?? undefined }), fingerprint },
    facts, unknowns, fixturePlan: { detectorTokens, requiredOutcomes }, reviewChecklist, template: { status, limitation },
    ...(reviewOnlyTemplateProposal ? { reviewOnlyTemplateProposal } : {}),
  };
}

function parseCandidate(value: unknown): ProviderRuleCandidate | null {
  if (!record(value)) return null;
  const id = text(value.id, 256); const providerId = text(value.providerId, 256); const title = text(value.title); const description = text(value.description, 8192);
  const status = text(value.status, 128); const severity = text(value.severity, 128); const source = record(value.source) ? { url: text(value.source.url, 2048), type: text(value.source.type, 128) } : null;
  const createdAt = text(value.createdAt, 128); const reviewNotes = nullableText(value.reviewNotes, 8192);
  const payload = value.payload === null ? null : record(value.payload) ? value.payload : undefined;
  const coverage = parseCoverage(value.coverage); const reviewPack = parseReviewPack(value.reviewPack);
  if (!id || !providerId || !title || !description || !status || !severity || !source?.url?.startsWith('https://') || !source.type || !createdAt || reviewNotes === undefined || payload === undefined || coverage === null && value.coverage !== null || reviewPack === null && value.reviewPack !== null) return null;
  return { id, providerId, title, description, status, severity, payload, source: { url: source.url, type: source.type }, createdAt, reviewNotes, coverage, reviewPack };
}

export function parseProviderRuleListResponse(value: unknown): { candidates: ProviderRuleCandidate[]; coverageSummary: ProviderRuleCoverageSummary } | null {
  if (!record(value) || value.ok !== true || !Array.isArray(value.candidates) || value.candidates.length > 200 || !record(value.coverageSummary)) return null;
  const candidates = value.candidates.map(parseCandidate);
  const summary = value.coverageSummary;
  const providersMissingReviewedRules = stringList(summary.providersMissingReviewedRules, 64, 256);
  const providersWithExecutableTemplates = stringList(summary.providersWithExecutableTemplates, 64, 256);
  if (candidates.some((candidate) => !candidate) || !Number.isSafeInteger(summary.candidates) || !Number.isSafeInteger(summary.pendingCandidates) || !Number.isSafeInteger(summary.reviewedCandidates) || !Number.isSafeInteger(summary.reviewedProviders) || Number(summary.candidates) < 0 || Number(summary.pendingCandidates) < 0 || Number(summary.reviewedCandidates) < 0 || Number(summary.reviewedProviders) < 0 || !providersMissingReviewedRules || !providersWithExecutableTemplates) return null;
  return { candidates: candidates as ProviderRuleCandidate[], coverageSummary: { candidates: Number(summary.candidates), pendingCandidates: Number(summary.pendingCandidates), reviewedCandidates: Number(summary.reviewedCandidates), reviewedProviders: Number(summary.reviewedProviders), providersMissingReviewedRules, providersWithExecutableTemplates } };
}

export function parseProviderRuleTestResponse(value: unknown): { matches: ProviderRuleTestMatch[] } | null {
  if (!record(value) || value.ok !== true || !Array.isArray(value.matches) || value.matches.length > 256) return null;
  const matches = value.matches.map((match) => {
    if (!record(match) || !text(match.token, 512) || !Number.isSafeInteger(match.line) || Number(match.line) < 1 || !text(match.snippet, 4096)) return null;
    return { token: text(match.token, 512)!, line: Number(match.line), snippet: text(match.snippet, 4096)! };
  });
  return matches.every((match): match is ProviderRuleTestMatch => match !== null) ? { matches } : null;
}
