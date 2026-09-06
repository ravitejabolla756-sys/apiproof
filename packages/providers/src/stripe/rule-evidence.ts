import { literalHash } from '@apiproof/shared';
import type { ChangeRule, ImpactFinding, ReasonCode, UsageFinding } from '@apiproof/shared';

export interface RuleMatch {
  matched: boolean; insufficient: boolean;
  reasonCode: ReasonCode;
  evidence: ImpactFinding['evidence'];
}
function symbolMatches(actual: string, expected: string, prefix: boolean): boolean {
  return actual === expected || (prefix && actual.startsWith(`${expected}.`));
}

export function matchRule(usage: UsageFinding, rule: ChangeRule): RuleMatch {
  const no = { matched: false, insufficient: false, reasonCode: 'SYMBOL_NOT_FOUND', evidence: [] } as const;
  if (usage.semantics === 'capability-check' && !(rule.kind !== 'response-field' && rule.includeCapabilityChecks)) return { ...no, evidence: [] };
  if (rule.kind === 'response-field') {
    const origin = usage.response;
    if (usage.kind !== 'response-field' || !origin || origin.fieldPath !== rule.path ||
        !(origin.originKind === 'method' ? rule.methods : rule.types).includes(origin.originSymbol)) return { ...no, evidence: [] };
    return { matched: true, insufficient: false, reasonCode: 'AFFECTED_RESPONSE_FIELD_REFERENCED',
      evidence: [{ kind: 'response-field', name: rule.path, location: usage.location },
        { kind: origin.originKind === 'method' ? 'method-call' : 'type-reference', symbol: origin.originSymbol, location: origin.originLocation },
        ...(origin.callbackLocation ? [{ kind: 'promise-callback' as const, location: origin.callbackLocation, detail: 'First fulfillment parameter of a proven provider Promise.' }] : [])] };
  }
  if (!symbolMatches(usage.symbol, rule.symbol, rule.match === 'prefix')) return { ...no, evidence: [] };
  if (rule.kind === 'parameter') {
    if (usage.kind !== 'method') return { ...no, evidence: [] };
    const argument = usage.arguments?.find((item) => item.index === rule.argumentIndex);
    const property = argument?.properties.find((item) => item.path === rule.path);
    const matched = !!property && (rule.condition === 'present' ||
      (rule.value !== undefined && property.literalHash === literalHash(rule.value) && argument?.complete === true));
    return { matched, insufficient: !matched && (!argument || !argument.complete || (!!property && !property.literalHash)),
      reasonCode: matched ? 'AFFECTED_PARAMETER_PRESENT' : 'INSUFFICIENT_STATIC_EVIDENCE',
      evidence: matched ? [{ kind: 'method-call', symbol: usage.symbol, location: usage.location },
        { kind: 'parameter', name: rule.path, location: property.location, detail: `Argument ${rule.argumentIndex}; ${rule.condition} predicate.` },
        ...(argument?.builders ?? []).map((builder) => ({ kind: 'parameter-builder' as const, name: builder.sourceFunction, location: builder.definition,
          callSite: builder.callSite, detail: `Bounded return propagation for ${rule.path}.` }))] : [] };
  }
  const matched = rule.kind === 'resource' ? ['resource', 'method'].includes(usage.kind) : usage.kind === rule.kind;
  const reasonCode = rule.kind === 'type' ? 'AFFECTED_TYPE_REFERENCED' : rule.kind === 'resource' ? 'AFFECTED_RESOURCE_USED' : 'AFFECTED_METHOD_USED';
  return { matched, insufficient: false, reasonCode,
    evidence: matched ? [{ kind: usage.semantics === 'capability-check' ? 'capability-check' : rule.kind === 'type' ? 'type-reference' : rule.kind === 'resource' ? 'resource' : usage.semantics === 'method-reference' ? 'method-reference' : 'method-call',
      symbol: usage.symbol, location: usage.location }] : [] };
}
