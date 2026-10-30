import crypto from 'node:crypto';
import type { ProductizationScanResult } from '@apiproof/analyzers';
import { extractSourceSnippet } from './scan-snippet.js';
import { redactSecretString } from './logger.js';

export interface ProductizationFinding {
  id: string; changeId: string; provider: string; title: string; description: string; severity: string;
  confidence: number; filePath: string; lineNumber: number; symbol: string; reason: string; reasonCodes: string[];
  evidence: unknown[]; sourceSnippet: string; sourceDigest: string;
}

/** Converts only structured affected evidence into the legacy finding envelope. */
export function productizationFindings(scan: ProductizationScanResult, files?: ReadonlyMap<string, string>): ProductizationFinding[] {
  return scan.compatibilityResults.filter((result) => result.status === 'AFFECTED').flatMap((result) => {
    const usage = result.matchedUsages[0];
    if (!usage) return [];
    const source = files?.get(usage.location.file);
    const sourceSnippet = source === undefined
      ? ''
      : redactSecretString(extractSourceSnippet(source, usage.location.line));
    const sourceDigest = source === undefined
      ? scan.baselineSha
      : crypto.createHash('sha256').update(source).digest('hex');
    return [{
      id: `fnd_${crypto.randomBytes(12).toString('hex')}`, changeId: result.changeId, provider: result.providerId,
      title: result.changeTitle, description: result.changeTitle, severity: result.severity ?? 'medium', confidence: result.confidence,
      filePath: usage.location.file, lineNumber: usage.location.line,
      symbol: usage.location.symbol ?? usage.operation ?? usage.model ?? usage.endpoint ?? result.changeId,
      reason: result.reasonCodes.join(', '), reasonCodes: result.reasonCodes, evidence: result.evidence,
      sourceSnippet, sourceDigest,
    } satisfies ProductizationFinding];
  });
}
