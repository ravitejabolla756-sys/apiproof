import semver from 'semver';
import { AnalysisError, ApiChangeSchema } from '@apiproof/shared';
import type { ApiChange, ChangeRule, Diagnostic, ImpactFinding, ScanResult } from '@apiproof/shared';
import type { ApiProvider } from '@apiproof/core';
import { validateRegistryChange } from './registry.js';
import { assessVersion } from './version.js';
import { matchRule } from './rule-evidence.js';

export class TwilioProvider implements ApiProvider {
  readonly descriptor = {
    id: 'twilio',
    packageName: 'twilio',
    constructorExports: ['default', 'twilio']
  } as const;

  validateChange(input: unknown): ApiChange {
    const parsed = ApiChangeSchema.safeParse(input);
    if (!parsed.success) throw new AnalysisError('INVALID_CHANGE', 'Change does not match the API change schema.');
    const change = parsed.data;
    if (change.provider !== 'twilio' || change.packageName !== 'twilio') throw new AnalysisError('UNSUPPORTED_PROVIDER', 'Only twilio package changes are supported.');
    if (change.affectedSdkVersions && !semver.validRange(change.affectedSdkVersions)) throw new AnalysisError('INVALID_VERSION_RANGE', 'affectedSdkVersions must be a valid npm semver range.');
    if (change.targetSdkVersion && !semver.valid(change.targetSdkVersion)) throw new AnalysisError('INVALID_TARGET_VERSION', 'targetSdkVersion must be an exact SDK version.');
    if (change.provenance === 'official') return validateRegistryChange(change);
    if (change.review?.status === 'draft') throw new AnalysisError('UNREVIEWED_CHANGE', 'Draft records cannot be analyzed.');
    return change;
  }

  matchImpact(scan: ScanResult, change: ApiChange): { impacts: ImpactFinding[]; diagnostics: Diagnostic[] } {
    change = this.validateChange(change);
    const impacts: ImpactFinding[] = [];
    const diagnostics: Diagnostic[] = [];
    if (change.provenance === 'synthetic') diagnostics.push({ code: 'SYNTHETIC_CHANGE', message: 'This fixture demonstrates matching and is not a factual Twilio migration advisory.' });
    if (change.apiVersion) diagnostics.push({ code: 'API_VERSION_UNVERIFIED', reasonCode: 'API_VERSION_UNVERIFIED', message: 'Runtime API versions remain unverified; findings concern migration to the supplied change.' });
    const rules: ChangeRule[] = change.rules ?? change.affectedSymbols;
    for (const usage of scan.usages) {
      const version = assessVersion(scan, usage, change);
      for (const rule of rules) {
        const match = matchRule(usage, rule);
        if (!match.matched && !match.insufficient) continue;
        if (version.outside) {
          diagnostics.push({ code: 'SDK_OUTSIDE_RANGE', reasonCode: version.reasonCode, file: usage.location.file, message: version.detail });
          break;
        }
        if (match.insufficient) {
          diagnostics.push({ code: 'INSUFFICIENT_STATIC_EVIDENCE', reasonCode: 'INSUFFICIENT_STATIC_EVIDENCE', file: usage.location.file,
            message: `Cannot determine the required argument evidence for ${usage.symbol}.` });
          continue;
        }
        const reasonCodes = [match.reasonCode, version.reasonCode];
        if (change.changeType === 'symbol-deprecated') reasonCodes.push('DEPRECATED_SYMBOL_USED');
        if (version.source === 'declared-exact') reasonCodes.push('DECLARED_VERSION_ONLY');
        if (change.apiVersion) reasonCodes.push('API_VERSION_UNVERIFIED');
        const ruleName = rule.kind === 'response-field' ? `response-field:${rule.path}`
          : `${rule.kind}:${rule.match}:${rule.symbol}${rule.kind === 'parameter' ? `:${rule.argumentIndex}:${rule.path}:${rule.condition}` : ''}`;
        impacts.push({ usageId: usage.id, changeId: change.id, affected: true, location: usage.location, symbol: usage.symbol,
          reason: `AST binding resolves to twilio.${usage.symbol}; ${ruleName} matches. ${version.detail}`,
          confidence: Math.min(usage.confidence, version.confidence), versionAssessment: version.assessment,
          matchedRule: ruleName, matchedRuleIndex: rules.indexOf(rule), reasonCodes,
          evidence: [...match.evidence, { kind: 'binding', location: usage.evidence.binding, detail: usage.evidence.basis },
            { kind: 'version', detail: version.detail },
            ...(change.evidenceSources ?? []).map((source) => ({ kind: 'official-source' as const, url: source.url, detail: source.summary }))],
        });
        break;
      }
    }
    if (!impacts.length && !diagnostics.some((item) => item.reasonCode === 'INSUFFICIENT_STATIC_EVIDENCE')) diagnostics.push({
      code: 'SYMBOL_NOT_FOUND', reasonCode: 'SYMBOL_NOT_FOUND', message: 'No applicable usage matched the supplied rules within the supported static scope.',
    });
    return { impacts, diagnostics };
  }
}
