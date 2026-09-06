import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AnalysisError, CorpusSchema, EvaluationResultSchema, readJsonFile, readTextFile } from '@apiproof/shared';
import type { ApiChange, EvaluationResult, ImpactResult, ExpectedUsage } from '@apiproof/shared';
import { compareUsages, usageKey } from './metrics.js';
import { breakdown, scoreCases } from './breakdown.js';

export { calculateMetrics, compareUsages } from './metrics.js';
export interface ImpactRunner { impact(repositoryPath: string, change: unknown): Promise<ImpactResult> }

export async function evaluateCorpus(directory: string, changes: ApiChange[], runner: ImpactRunner): Promise<EvaluationResult> {
  const parsed = CorpusSchema.safeParse(await readJsonFile(path.join(directory, 'labels/cases.json'), directory, 1_048_576));
  if (!parsed.success) throw new AnalysisError('INVALID_CORPUS', 'Corpus labels violate the evaluation schema.');
  const corpus = parsed.data;
  const registry = new Map(changes.map((change) => [change.id, change]));
  if (registry.size !== changes.length) throw new AnalysisError('DUPLICATE_CHANGE', 'Evaluation change IDs must be unique.');
  // Validate every record referenced by labels before doing any analysis.
  for (const item of corpus.cases) {
    const change = registry.get(item.changeId);
    if (!change || change.provenance !== 'official' || !change.review || change.review.status === 'draft') {
      throw new AnalysisError('UNREVIEWED_CHANGE', 'Evaluation requires existing reviewed or verified official registry records.');
    }
  }
  const root = await realpath(directory);
  const cases: EvaluationResult['cases'] = [];
  for (const item of corpus.cases) {
    const requested = await realpath(path.resolve(root, item.repository)).catch(() => undefined);
    const relative = requested ? path.relative(root, requested) : '..';
    if (!requested || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new AnalysisError('INVALID_CORPUS_PATH', 'Corpus repository must exist within the evaluation directory.');
    }
    for (const expected of item.expectedUsages) {
      const text = await readTextFile(path.join(requested, expected.file), requested, 1_048_576);
      const line = text.split('\n')[expected.line - 1];
      if (line === undefined || expected.column > line.length || expected.column < 1) {
        throw new AnalysisError('INVALID_LABEL_LOCATION', 'An expected source position is outside its source file.');
      }
    }
    let result: ImpactResult | undefined;
    let failure: string | undefined;
    try { result = await runner.impact(requested, registry.get(item.changeId)); }
    catch (error) { failure = error instanceof AnalysisError ? error.code : 'ANALYSIS_FAILED'; }
    const predictedUsages: ExpectedUsage[] = [...new Map((result?.impacts ?? []).map((impact) => {
      const usage = { file: impact.location.file, symbol: impact.symbol, line: impact.location.start.line, column: impact.location.start.column };
      return [usageKey(usage), usage] as const;
    })).values()];
    const predictedAffected = failure ? null : predictedUsages.length > 0;
    const comparison = compareUsages(item.expectedUsages, predictedUsages);
    cases.push({ id: item.id, repository: item.repository, changeId: item.changeId, expectedAffected: item.affected, predictedAffected,
      changeCategory: registry.get(item.changeId)?.changeType ?? 'uncategorized', evidencePattern: item.evidencePattern, provenance: item.provenance,
      ...(item.regressionId ? { regressionId: item.regressionId } : {}),
      outcome: failure ? 'ERROR' : item.affected ? predictedAffected ? 'TP' : 'FN' : predictedAffected ? 'FP' : 'TN',
      status: failure ? 'failed' : result?.status ?? 'failed',
      expectedUsages: item.expectedUsages, predictedUsages, missedUsages: comparison.missed, unexpectedUsages: comparison.unexpected,
      explanation: item.explanation, diagnostics: failure ? [failure] : [...(result?.scan.diagnostics ?? []), ...(result?.diagnostics ?? [])].map((diagnostic) => diagnostic.code),
      inputDigest: result?.scan.audit.inputDigest ?? null, changeDigest: result?.changeDigest ?? null });
  }
  return EvaluationResultSchema.parse({ schemaVersion: '1.1', corpusId: corpus.id,
    labelDigest: createHash('sha256').update(JSON.stringify(corpus)).digest('hex'), provenance: corpus.provenance,
    repositories: new Set(cases.map((item) => item.repository)).size, changeRecords: new Set(cases.map((item) => item.changeId)).size,
    groundTruthCases: cases.length,
    byChangeCategory: breakdown(cases, 'changeCategory'), byEvidencePattern: breakdown(cases, 'evidencePattern'),
    ...scoreCases(cases),
    scoredCases: cases.filter((item) => item.status !== 'failed').length, cases });
}
