import { createHash } from 'node:crypto';
import path from 'node:path';
import { AnalysisError, PlanningInputSchema, RegistryChangeSchema, readTextFile } from '@apiproof/shared';
import type { ImpactResult, PlanningInput, PlanningEvidence, DeterministicFact, SourceSnippet } from '@apiproof/shared';

const MAX_LINES = 24;
const MAX_CHARS = 12_000;
const MAX_TOTAL_CHARS = 64_000;

function redact(source: string): { text: string; redacted: boolean } {
  let text = source;
  const before = text;
  text = text.replace(/process\.env\.[A-Za-z_$][\w$]*/g, '[REDACTED_ENV]');
  text = text.replace(/(['"])(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\1/g, '$1[REDACTED_SECRET]$1');
  text = text.replace(/((?:api[_-]?key|secret|token|password)\s*[:=]\s*)(['"])[^'"\r\n]*\2/gi, '$1$2[REDACTED_SECRET]$2');
  return { text, redacted: text !== before };
}

function evidenceId(usageId: string, index: number): string { return `impact:${usageId}:${index}`; }

export async function buildPlanningContext(repository: string, impact: ImpactResult): Promise<PlanningInput> {
  const change = RegistryChangeSchema.safeParse(impact.change);
  if (!change.success) throw new AnalysisError('UNREVIEWED_CHANGE', 'Planning requires a reviewed official registry record.');
  const evidence: PlanningEvidence[] = [{ id: `change:${change.data.id}`, kind: 'change', label: `Reviewed change record ${change.data.id}.`, changeId: change.data.id }];
  for (const [index, source] of change.data.evidenceSources.entries()) {
    evidence.push({ id: `source:${change.data.id}:${index}`, kind: 'official-source', label: source.summary, changeId: change.data.id, url: source.url });
  }
  const facts: DeterministicFact[] = [{ id: `fact:change:${change.data.id}`, kind: 'change', statement: `Change record ${change.data.id} is reviewed and official.`, evidenceIds: [`change:${change.data.id}`] }];
  const snippets: SourceSnippet[] = [];
  const warnings = [...impact.diagnostics.map((item) => `${item.code}: ${item.message}`)];
  const unresolvedQuestions: string[] = [];
  for (const dependency of impact.scan.dependencies.filter((item) => item.packageName === change.data.packageName)) {
    const version = dependency.versionResolution?.version ?? dependency.installedVersion ?? dependency.lockedVersion ?? 'unknown';
    const id = `fact:package:${dependency.manifest}`;
    const statement = `Package ${dependency.packageName} resolves to ${version} (${dependency.versionResolution?.source ?? 'unknown'}).`;
    facts.push({ id, kind: 'package', statement, evidenceIds: [`change:${change.data.id}`] });
  }
  const files = new Map<string, string>();
  for (const [impactIndex, item] of impact.impacts.entries()) {
    const baseEvidence = `impact:${item.usageId}`;
    evidence.push({ id: baseEvidence, kind: 'impact', label: `${item.symbol} is potentially affected at ${item.location.file}:${item.location.start.line}:${item.location.start.column}.`, changeId: item.changeId, symbol: item.symbol, location: item.location });
    facts.push({ id: `fact:operation:${item.usageId}`, kind: 'operation', statement: `Affected operation or response symbol: ${item.symbol}.`, evidenceIds: [baseEvidence], location: item.location, symbol: item.symbol });
    facts.push({ id: `fact:location:${item.usageId}`, kind: 'location', statement: `Affected source location: ${item.location.file}:${item.location.start.line}:${item.location.start.column}.`, evidenceIds: [baseEvidence], location: item.location, symbol: item.symbol });
    for (const [evidenceIndex, itemEvidence] of item.evidence.entries()) {
      const id = evidenceId(item.usageId, evidenceIndex);
      evidence.push({ id, kind: 'impact', label: itemEvidence.detail ?? itemEvidence.name ?? itemEvidence.symbol ?? 'Deterministic impact evidence.', changeId: item.changeId, symbol: itemEvidence.symbol ?? item.symbol, location: itemEvidence.location });
      if (itemEvidence.kind === 'parameter' && itemEvidence.name) facts.push({ id: `fact:parameter:${item.usageId}:${evidenceIndex}`, kind: 'parameter', statement: `Affected parameter: ${itemEvidence.name}.`, evidenceIds: [id], location: itemEvidence.location, symbol: item.symbol });
    }
    const sourceFile = item.location.file;
    if (!files.has(sourceFile)) {
      try { files.set(sourceFile, await readTextFile(path.join(repository, sourceFile), repository, 1_048_576)); }
      catch { warnings.push(`SOURCE_CONTEXT_UNAVAILABLE: Could not read bounded source context for ${sourceFile}.`); }
    }
    const source = files.get(sourceFile);
    if (source) {
      const lines = source.split(/\r?\n/);
      const start = Math.max(1, item.location.start.line - 8);
      const end = Math.min(lines.length, Math.max(start, item.location.end.line + 8, item.location.start.line + 8));
      const redacted = redact(lines.slice(start - 1, end).join('\n'));
      if (redacted.text.length <= MAX_CHARS && snippets.reduce((sum, value) => sum + value.text.length, 0) + redacted.text.length <= MAX_TOTAL_CHARS) {
        const id = `snippet:${sourceFile}:${item.location.start.line}`;
        snippets.push({ evidenceId: id, file: sourceFile, startLine: start, endLine: end, text: redacted.text, redacted: redacted.redacted });
        evidence.push({ id, kind: 'snippet', label: `Bounded redacted context for ${sourceFile}:${item.location.start.line}.`, location: item.location });
      } else warnings.push(`CONTEXT_BOUND_REACHED: Source context for ${sourceFile}:${item.location.start.line} was omitted or truncated.`);
    }
    if (impactIndex >= 99) break;
  }
  if (impact.status !== 'potentially-affected') {
    warnings.push(`Impact status is ${impact.status}; planning cannot infer missing provenance.`);
    unresolvedQuestions.push('Which exact source usage should be migrated after the unsupported static pattern is resolved?');
  }
  if (!impact.scan.coverage.complete) unresolvedQuestions.push('Can a human reviewer resolve the analyzer coverage gaps before planning a transformation?');
  const sourceDigest = createHash('sha256').update(JSON.stringify(snippets)).digest('hex');
  return PlanningInputSchema.parse({
    change: change.data, repository, impacts: impact.impacts.map((item) => ({ usageId: item.usageId, changeId: item.changeId, symbol: item.symbol, location: item.location, reason: item.reason, confidence: item.confidence, versionAssessment: item.versionAssessment, reasonCodes: item.reasonCodes })),
    facts, evidence, snippets, migrationInstructions: change.data.migrationInstructions, warnings, unresolvedQuestions,
    bounds: { maxSnippetLines: MAX_LINES, maxSnippetChars: MAX_CHARS, maxTotalChars: MAX_TOTAL_CHARS }, sourceDigest, analysisDigest: impact.scan.audit.inputDigest,
  });
}
