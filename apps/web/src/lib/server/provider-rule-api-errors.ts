const EDIT_ERROR_CODES = new Set([
  'INVALID_CANDIDATE_ID',
  'INVALID_REVIEWER_ID',
  'INVALID_EDIT_NOTES',
  'RULE_CANDIDATE_NOT_FOUND',
  'RULE_CANDIDATE_NOT_REVIEWABLE',
  'RULE_CANDIDATE_PAYLOAD_INVALID',
  'RULE_CANDIDATE_EDIT_CONFLICT',
]);

const REVIEW_ERROR_CODES = new Set([
  'INVALID_CANDIDATE_ID',
  'INVALID_REVIEWER_ID',
  'INVALID_REVIEW_NOTES',
  'RULE_CANDIDATE_NOT_FOUND',
  'RULE_CANDIDATE_NOT_REVIEWABLE',
  'RULE_CANDIDATE_PAYLOAD_INVALID',
  'RULE_CANDIDATE_REQUIRES_STRUCTURED_REVIEW',
  'RULE_CANDIDATE_REVIEW_CONFLICT',
  'RULE_MIGRATION_SOURCE_MISMATCH',
  'RULE_REVIEW_EVIDENCE_INVALID',
  'RULE_REVIEW_EVIDENCE_REQUIRES_DETECTABLE_TOKEN',
  'RULE_REVIEW_AFFECTED_FIXTURE_MUST_MATCH',
  'RULE_REVIEW_UNAFFECTED_FIXTURE_MUST_NOT_MATCH',
  'PARAMETER_CONDITION_DUPLICATE',
  'PARAMETER_CONDITION_PARAMETER_NOT_AFFECTED',
]);

const REVIEW_DYNAMIC_CODE_PREFIXES = [
  'APPLICABILITY_SCOPE_DIMENSION_REQUIRED',
  'APPLICABILITY_SCOPE_VALUE_REQUIRED',
  'APPLICABILITY_SCOPE_TARGET_REQUIRED',
] as const;

function allowlistedCode(error: unknown, exactCodes: ReadonlySet<string>, dynamicPrefixes: ReadonlyArray<string> = []): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (exactCodes.has(error.message)) return error.message;
  return dynamicPrefixes.find((prefix) => error.message.startsWith(`${prefix}:`));
}

export function mapProviderRuleEditError(error: unknown): { code: string; status: number } {
  const code = allowlistedCode(error, EDIT_ERROR_CODES)
    ?? (error instanceof Error && error.name === 'ZodError' ? 'INVALID_RULE_EDIT' : 'INTERNAL_ERROR');
  if (code === 'RULE_CANDIDATE_NOT_FOUND') return { code, status: 404 };
  if (code === 'RULE_CANDIDATE_NOT_REVIEWABLE' || code === 'RULE_CANDIDATE_EDIT_CONFLICT') return { code, status: 409 };
  if (code.startsWith('INVALID_') || code === 'INVALID_RULE_EDIT') return { code, status: 400 };
  return { code, status: 500 };
}

export function mapProviderRuleReviewError(error: unknown): { code: string; status: number } {
  const code = allowlistedCode(error, REVIEW_ERROR_CODES, REVIEW_DYNAMIC_CODE_PREFIXES) ?? 'INTERNAL_ERROR';
  if (code === 'RULE_CANDIDATE_NOT_FOUND') return { code, status: 404 };
  if (code === 'INVALID_REVIEWER_ID' || code === 'INVALID_REVIEW_NOTES' || code === 'INVALID_CANDIDATE_ID') return { code, status: 400 };
  if (code === 'RULE_CANDIDATE_PAYLOAD_INVALID') return { code, status: 500 };
  if (code === 'INTERNAL_ERROR') return { code, status: 500 };
  return { code, status: 409 };
}
