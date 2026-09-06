import type { ImpactResult, ScanResult } from '@apiproof/shared';

/** Filenames, symbols and fixtures are untrusted terminal content. JSON remains lossless. */
function safe(value: string): string { return value.replace(/[\p{Cc}\p{Cf}]/gu, '?'); }

export function formatScan(scan: ScanResult): string {
  const lines = [
    `APIProof — ${scan.provider} / ${scan.language}`,
    `Provider detected: ${scan.providerUsed ? 'yes' : 'no'}`,
    `Analyzed ${scan.coverage.filesAnalyzed} TypeScript files; ${scan.coverage.filesSkipped} skipped.`,
    `Coverage: ${scan.coverage.complete ? 'no detected gaps within supported syntax' : 'incomplete; see diagnostics'}`,
  ];
  for (const dependency of scan.dependencies) {
    lines.push(`Package (${dependency.manifest}): declared ${dependency.declarations.map((entry) => entry.range).join(', ') || 'not declared'}; installed ${dependency.installedVersion ?? 'unknown'}; locked ${dependency.lockedVersion ?? 'unknown'}`);
    if (dependency.versionResolution) lines.push(`  Resolved SDK: ${dependency.versionResolution.version ?? 'unknown'} (${dependency.versionResolution.source})`);
  }
  for (const usage of scan.usages) {
    const context = [usage.context.class, usage.context.function].filter(Boolean).join('.');
    lines.push(`  ${usage.location.file}:${usage.location.start.line}:${usage.location.start.column}  ${usage.kind} ${usage.symbol}${context ? ` (${context})` : ''}`);
  }
  for (const diagnostic of scan.diagnostics) lines.push(`Warning [${diagnostic.code}]${diagnostic.file ? ` ${diagnostic.file}` : ''}: ${diagnostic.message}`);
  lines.push(`Input digest: ${scan.audit.inputDigest}`, 'Static analysis only. No customer code was executed.');
  return lines.map(safe).join('\n');
}

export function formatImpact(result: ImpactResult): string {
  return [formatScan(result.scan), '', ...[
    `Change: ${result.change.id} (${result.change.provenance})`,
    `Analysis mode: ${result.analysisMode}`,
    `Result: ${result.status}; ${result.impacts.length} potentially affected usage(s).`,
    ...result.impacts.flatMap((impact) => [
      `  ${impact.location.file}:${impact.location.start.line}:${impact.location.start.column} ${impact.symbol}`,
      `    ${impact.reason} Confidence: ${impact.confidence.toFixed(2)}`,
      `    Reasons: ${impact.reasonCodes.join(', ')}`,
    ]),
    ...result.diagnostics.map((diagnostic) => `Warning [${diagnostic.code}]: ${diagnostic.message}`),
    'Verification: not run. Human review is required; this report is not proof of a safe migration.',
  ].map(safe)].join('\n');
}
