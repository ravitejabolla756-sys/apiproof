import type { ContractAssertion, ContractAssertionResult } from '@apiproof/shared';
import { getPath } from './normalize.js';

export function assertContract(assertion: ContractAssertion, target: unknown): ContractAssertionResult {
  const path = assertion.path ?? null;
  const fieldTarget = target && typeof target === 'object' && 'body' in target ? (target as { body: unknown }).body : target;
  const observed = path ? (getPath(target, path) ?? getPath(fieldTarget, path)) : target;
  let passed: boolean;
  switch (assertion.assertion) {
    case 'FIELD_PRESENT': passed = observed !== undefined; break;
    case 'FIELD_ABSENT': passed = observed === undefined; break;
    case 'FIELD_EQUALS_LITERAL':
    case 'RETURN_VALUE_EQUALS':
    case 'OUTPUT_FIELD_EQUALS': passed = JSON.stringify(observed) === JSON.stringify(assertion.expected ?? assertion.value); break;
    case 'ARRAY_MIN_LENGTH': passed = Array.isArray(observed) && observed.length >= Number(assertion.expected ?? assertion.value); break;
    case 'TYPE_MATCHES': passed = typeof observed === assertion.expected; break;
    case 'METHOD_EQUALS': passed = Boolean(target && typeof target === 'object' && (target as { method?: string }).method === assertion.expected); break;
    case 'PATH_EQUALS': passed = Boolean(target && typeof target === 'object' && (target as { path?: string }).path === assertion.expected); break;
    case 'HEADER_PRESENT': passed = Boolean(path && ((path === 'authorization' && getPath(target, 'headers.authorizationPresent')) || (path === 'contentType' && getPath(target, 'headers.contentType')))); break;
    case 'HEADER_ABSENT': passed = Boolean(path && !((path === 'authorization' && getPath(target, 'headers.authorizationPresent')) || (path === 'contentType' && getPath(target, 'headers.contentType')))); break;
    case 'NO_ERROR': passed = true; break;
    case 'EXPECTED_ERROR': passed = Boolean(getPath(target, 'error')); break;
    default: passed = false;
  }
  return { assertion: assertion.assertion, path, passed, expected: assertion.expected ?? assertion.value, observed, reason: passed ? 'Assertion matched.' : 'Assertion did not match.' };
}

export function allAssertions(assertions: ContractAssertion[], target: unknown): ContractAssertionResult[] {
  return assertions.map((assertion) => assertContract(assertion, target));
}
