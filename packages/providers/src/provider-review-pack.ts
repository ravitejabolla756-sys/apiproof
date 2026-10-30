import type { CandidateChange, ReviewedCompatibilityChange } from '@apiproof/shared';
import { fingerprintCandidate } from './candidate-review.js';
import type { MigrationTemplateCoverage } from './migration-template-coverage.js';
import { deriveReviewOnlyTemplateProposal } from './provider-template-proposals.js';
import type { ReviewOnlyTemplateProposal } from './provider-template-proposals.js';

export type ProviderReviewPackEntry = {
  providerId: string;
  candidateId: string;
  changeId: string;
  title: string;
  state: CandidateChange['state'];
  productionReviewed: boolean;
  source: {
    url: string;
    type: string;
    title: string | undefined;
    locator: string | undefined;
    fingerprint: string;
    evidenceFingerprint: string | undefined;
    fingerprintBasis: CandidateChange['sourceFingerprintBasis'];
    claims: readonly { key: string; value: string }[];
  };
  scope: readonly string[];
  facts: readonly string[];
  unknowns: readonly string[];
  replacement: CandidateChange['payload']['replacement'];
  template: {
    status: MigrationTemplateCoverage['status'];
    templateIds: readonly string[];
    limitation: string;
  };
  reviewOnlyTemplateProposal?: ReviewOnlyTemplateProposal;
  candidateFingerprint: string;
  fixturePlan: {
    detectorTokens: readonly string[];
    requiredOutcomes: readonly ['affected', 'unaffected', 'uncertain'];
    examples: readonly [
      { kind: 'affected' | 'unaffected' | 'uncertain'; filePath: string; code: string; purpose: string },
      { kind: 'affected' | 'unaffected' | 'uncertain'; filePath: string; code: string; purpose: string },
      { kind: 'affected' | 'unaffected' | 'uncertain'; filePath: string; code: string; purpose: string },
    ];
  };
  reviewChecklist: readonly string[];
};

export type ProviderReviewPack = {
  generatedAt: string;
  expectedProviderCount: number;
  entries: readonly ProviderReviewPackEntry[];
  summary: {
    total: number;
    pending: number;
    reviewed: number;
    rejected: number;
    providers: number;
    providersWithPendingReview: string[];
    providersMissingCandidates: string[];
    providersOutsideMonitoredCatalog: string[];
    reviewOnlyTemplateProposals: number;
    providersWithReviewOnlyTemplateProposals: string[];
    candidatesWithoutTemplateProposal: string[];
  };
};

type TemplateEntry = Pick<MigrationTemplateCoverage, 'providerId' | 'status' | 'templateIds' | 'limitation'>;

function detectorTokens(candidate: CandidateChange): string[] {
  const payload = candidate.payload as Record<string, unknown>;
  const keys = ['apiOperationPatterns', 'affectedModels', 'affectedEndpoints', 'affectedParameters', 'affectedResponseFields', 'affectedDomains', 'affectedResources', 'authOrHeaderPatterns'] as const;
  const tokens: string[] = [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) for (const item of value) if (typeof item === 'string' && item.trim()) tokens.push(item.trim());
  }
  const version = payload.apiVersionMetadata;
  if (version && typeof version === 'object' && !Array.isArray(version)) {
    for (const key of ['version', 'replacement'] as const) {
      const value = (version as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) tokens.push(value.trim());
    }
  }
  return [...new Set(tokens)].slice(0, 20);
}

function reviewChecklist(candidate: CandidateChange, hasExecutableTemplate: boolean): string[] {
  const checklist = [
    'Confirm the official source still matches the bound source fingerprint.',
    'Confirm every applicability dimension is supported by the source claims.',
    'Confirm the replacement or mitigation is explicit; reject guessed SDK or endpoint mappings.',
    'Record fixture evidence for every detector token before production promotion.',
  ];
  if (!hasExecutableTemplate) checklist.push('Keep the finding review-only; no executable migration template is registered for this provider.');
  if (candidate.payload.unknowns?.length) checklist.push('Resolve or explicitly accept each listed unknown in the review notes.');
  return checklist;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Produces review-only fixture examples from bounded source-derived tokens.
 * These examples are never executed or persisted as repository code; they
 * simply give a reviewer a deterministic starting point for the required
 * affected/unaffected/uncertain evidence cases.
 */
function fixtureExamples(candidate: CandidateChange, tokens: readonly string[]): ProviderReviewPackEntry['fixturePlan']['examples'] {
  const token = tokens[0] ?? 'provider-specific-usage';
  const safeIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token);
  const safePropertyPath = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(token);
  const affectedCode = token.startsWith('/')
    ? `const response = await fetch(${quote(token)});`
    : safePropertyPath
      ? `const value = response.${token};`
      : safeIdentifier
        ? `const request = { ${token}: value };`
        : `const request = { [${quote(token)}]: value };`;
  const dynamicCode = token.startsWith('/')
    ? `const endpoint = process.env.PROVIDER_ENDPOINT;\nconst response = await fetch(endpoint);`
    : `const configuredValue = process.env.PROVIDER_VALUE;\nconst result = client.call(configuredValue);`;
  return [
    { kind: 'affected', filePath: `review-fixtures/${candidate.providerId}-affected.ts`, code: affectedCode, purpose: `Must match the bounded detector token ${quote(token)}.` },
    { kind: 'unaffected', filePath: `review-fixtures/${candidate.providerId}-unaffected.ts`, code: 'const unrelated = "unrelated-provider-value";', purpose: 'Must not match any detector token.' },
    { kind: 'uncertain', filePath: `review-fixtures/${candidate.providerId}-uncertain.ts`, code: dynamicCode, purpose: 'Exercises dynamic configuration that must remain review-only unless separately proven.' },
  ];
}

/** Builds a deterministic reviewer bundle without changing candidate state. */
export function buildProviderReviewPack(input: {
  candidates: readonly CandidateChange[];
  monitoredProviderIds: readonly string[];
  reviewedChanges: readonly Pick<ReviewedCompatibilityChange, 'providerId' | 'changeId'>[];
  templateCoverage: readonly TemplateEntry[];
  expectedProviderCount?: number;
  generatedAt?: string;
}): ProviderReviewPack {
  const reviewedKeys = new Set(input.reviewedChanges.map((change) => `${change.providerId}:${change.changeId}`));
  const templates = new Map(input.templateCoverage.map((entry) => [entry.providerId, entry]));
  const monitored = [...new Set(input.monitoredProviderIds)].sort();
  const entries = [...input.candidates].sort((a, b) => `${a.providerId}:${a.candidateId}`.localeCompare(`${b.providerId}:${b.candidateId}`, 'en')).map((candidate) => {
    const changeId = candidate.payload.changeId ?? candidate.candidateId;
    const template = templates.get(candidate.providerId) ?? {
      providerId: candidate.providerId,
      status: 'review-only' as const,
      templateIds: [],
      limitation: 'Provider is not present in the migration-template catalog.',
    };
    const sourceEvidence = candidate.sourceEvidence;
    const hasExactTemplate = template.status === 'deterministic-ast' && template.templateIds.includes(changeId);
    const candidateTemplate = hasExactTemplate
      ? template
      : {
        providerId: template.providerId,
        status: 'review-only' as const,
        templateIds: [] as readonly string[],
        limitation: template.status === 'deterministic-ast'
          ? `The provider has deterministic templates, but no exact template is registered for ${changeId}; remediation remains review-only.`
          : template.limitation,
      };
    const reviewOnlyTemplateProposal = deriveReviewOnlyTemplateProposal(candidate);
    return {
      providerId: candidate.providerId,
      candidateId: candidate.candidateId,
      changeId,
      title: candidate.payload.title,
      state: candidate.state,
      productionReviewed: reviewedKeys.has(`${candidate.providerId}:${changeId}`),
      source: {
        url: candidate.sourceUrl,
        type: candidate.sourceType,
        title: sourceEvidence?.sourceTitle ?? candidate.payload.sourceTitle,
        locator: sourceEvidence?.sourceLocator,
        fingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
        evidenceFingerprint: candidate.evidenceFingerprint,
        fingerprintBasis: candidate.sourceFingerprintBasis,
        claims: [...(sourceEvidence?.claims ?? [])],
      },
      scope: [...(candidate.payload.applicabilityScope?.dimensions ?? [])],
      facts: [...(candidate.payload.sourceFacts ?? [])],
      unknowns: [...(candidate.payload.unknowns ?? [])],
      replacement: candidate.payload.replacement,
      template: {
        status: candidateTemplate.status,
        templateIds: [...candidateTemplate.templateIds],
        limitation: candidateTemplate.limitation,
      },
      ...(reviewOnlyTemplateProposal ? { reviewOnlyTemplateProposal } : {}),
      candidateFingerprint: fingerprintCandidate(candidate),
      fixturePlan: {
        detectorTokens: detectorTokens(candidate),
        requiredOutcomes: ['affected', 'unaffected', 'uncertain'],
        examples: fixtureExamples(candidate, detectorTokens(candidate)),
      },
      reviewChecklist: reviewChecklist(candidate, candidateTemplate.status === 'deterministic-ast'),
    } satisfies ProviderReviewPackEntry;
  });
  const pendingEntries = entries.filter((entry) => !reviewedKeys.has(`${entry.providerId}:${entry.changeId}`));
  const candidateProviders = new Set(entries.map((entry) => entry.providerId));
  const providersOutsideMonitoredCatalog = [...candidateProviders].filter((providerId) => !monitored.includes(providerId)).sort();
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    expectedProviderCount: input.expectedProviderCount ?? monitored.length,
    entries,
    summary: {
      total: entries.length,
      pending: pendingEntries.length,
      reviewed: entries.length - pendingEntries.length,
      rejected: entries.filter((entry) => entry.state === 'rejected').length,
      providers: candidateProviders.size,
      providersWithPendingReview: [...new Set(pendingEntries.map((entry) => entry.providerId))].sort(),
      providersMissingCandidates: monitored.filter((providerId) => !candidateProviders.has(providerId)),
      providersOutsideMonitoredCatalog,
      reviewOnlyTemplateProposals: entries.filter((entry) => entry.reviewOnlyTemplateProposal !== undefined).length,
      providersWithReviewOnlyTemplateProposals: [...new Set(entries.filter((entry) => entry.reviewOnlyTemplateProposal !== undefined).map((entry) => entry.providerId))].sort(),
      candidatesWithoutTemplateProposal: entries.filter((entry) => entry.reviewOnlyTemplateProposal === undefined).map((entry) => entry.candidateId),
    },
  };
}

/** Stable Markdown rendering for human review; URLs and claims remain verbatim. */
export function renderProviderReviewPackMarkdown(pack: ProviderReviewPack): string {
  const lines = [
    '# MY OWL provider review pack',
    '',
    `Generated: ${pack.generatedAt}`,
    `Candidates: ${pack.summary.total} | pending: ${pack.summary.pending} | reviewed: ${pack.summary.reviewed}`,
    `Providers with pending review: ${pack.summary.providersWithPendingReview.join(', ') || 'none'}`,
    `Providers outside monitored launch catalog: ${pack.summary.providersOutsideMonitoredCatalog.join(', ') || 'none'}`,
    `Review-only template proposals: ${pack.summary.reviewOnlyTemplateProposals} | candidates without a proposal: ${pack.summary.candidatesWithoutTemplateProposal.length}`,
    '',
    '> This is an evidence bundle, not an approval record. Do not promote a candidate without an explicit human review action bound to all fingerprints.',
    '',
  ];
  for (const entry of pack.entries) {
    lines.push(`## ${entry.providerId}: ${entry.title}`, '', `- Candidate: \`${entry.candidateId}\``, `- Candidate lifecycle state: **${entry.state}**`, `- Production registry review binding: **${entry.productionReviewed ? 'present' : 'absent'}**`, `- Change ID: \`${entry.changeId}\``, `- Source: [${entry.source.title ?? entry.source.url}](${entry.source.url})`, `- Source fingerprint: \`${entry.source.fingerprint}\``, `- Evidence fingerprint: \`${entry.source.evidenceFingerprint ?? 'not supplied'}\``, `- Candidate fingerprint: \`${entry.candidateFingerprint}\``, `- Scope: ${entry.scope.join(', ') || 'not specified'}`, `- Migration template: **${entry.template.status}**${entry.template.templateIds.length ? ` (${entry.template.templateIds.join(', ')})` : ''}`, `- Template limitation: ${entry.template.limitation}`);
    lines.push(`- Fixture outcomes required: ${entry.fixturePlan.requiredOutcomes.join(', ')}`, `- Detector tokens to exercise: ${entry.fixturePlan.detectorTokens.join(', ') || 'none extracted; keep the rule review-only until a bounded detector token is defined.'}`);
    lines.push('', '### Fixture examples (review-only)');
    for (const fixture of entry.fixturePlan.examples) {
      lines.push(`- **${fixture.kind}** — ${fixture.filePath}: ${fixture.purpose}`, '```ts', fixture.code, '```');
    }
    if (entry.reviewOnlyTemplateProposal) {
      lines.push(`- Review-only template proposal: \`${entry.reviewOnlyTemplateProposal.templateId}\` (${entry.reviewOnlyTemplateProposal.mode})`, `- Proposal limitation: ${entry.reviewOnlyTemplateProposal.limitation}`);
      if (entry.reviewOnlyTemplateProposal.mode === 'manual-guidance') {
        lines.push(`- Manual migration summary: ${entry.reviewOnlyTemplateProposal.guidance.summary}`, '- Manual migration steps:');
        for (const step of entry.reviewOnlyTemplateProposal.guidance.steps) lines.push(`  - ${step}`);
        lines.push('- Manual validation requirements:');
        for (const check of entry.reviewOnlyTemplateProposal.guidance.validation) lines.push(`  - ${check}`);
      }
    }
    if (entry.source.locator) lines.push(`- Source locator: ${entry.source.locator}`);
    if (entry.source.claims.length) {
      lines.push('', '### Source claims');
      for (const claim of entry.source.claims) lines.push(`- ${claim.key}: ${claim.value}`);
    }
    if (entry.facts.length) {
      lines.push('', '### Facts');
      for (const fact of entry.facts) lines.push(`- ${fact}`);
    }
    if (entry.unknowns.length) {
      lines.push('', '### Unknowns');
      for (const unknown of entry.unknowns) lines.push(`- ${unknown}`);
    }
    lines.push('', '### Review checklist');
    for (const item of entry.reviewChecklist) lines.push(`- [ ] ${item}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
