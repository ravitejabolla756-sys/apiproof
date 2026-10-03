import ts from 'typescript';
import type { PlanningInput, PatchEdit, PatchTransformation } from '@apiproof/shared';
import { sha256 } from './policy.js';
export interface AuthorizedTarget extends PatchEdit { path: string; symbol: string; originalDigest: string }

export function syntaxValid(file: string, source: string): boolean {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length === 0;
}

function isStripeCouponMigration(input: PlanningInput, semantics: PatchTransformation | undefined): boolean {
  return input.change.provider === 'stripe'
    && input.change.id === 'stripe-subscription-coupon-removed'
    && semantics?.kind === 'singleton-discount'
    && semantics.destination === 'discounts'
    && semantics.paths.includes('coupon');
}

function isTestFile(file: string): boolean {
  return /(?:^|\/)(?:tests|__tests__)\//.test(file) || /\.(?:test|spec)\.tsx?$/.test(file);
}

function fileStem(file: string): string {
  return file.split('/').at(-1)!.replace(/\.(?:(?:test|spec)\.)?(?:tsx?|mts|cts)$/i, '');
}

function isRelatedTestFile(testFile: string, sourceFile: string): boolean {
  return isTestFile(testFile) && fileStem(testFile) === fileStem(sourceFile);
}

function assertionObjects(call: ts.CallExpression, sourceSymbol: string): ts.ObjectLiteralExpression[] {
  if (!ts.isPropertyAccessExpression(call.expression)) return [];
  if (!new Set(['toHaveBeenCalledWith', 'toHaveBeenLastCalledWith', 'toHaveBeenNthCalledWith', 'toMatchObject']).has(call.expression.name.text)) return [];
  const expectation = call.expression.expression;
  const sourceMethod = sourceSymbol.split('.').at(-1);
  if (!sourceMethod || !ts.isCallExpression(expectation) || !ts.isIdentifier(expectation.expression) || expectation.expression.text !== 'expect') return [];
  const actual = expectation.arguments[0];
  const actualMethod = actual && ts.isPropertyAccessExpression(actual) ? actual.name.text : actual && ts.isIdentifier(actual) ? actual.text : undefined;
  if (actualMethod !== sourceMethod) return [];
  const first = call.arguments[0];
  if (first && ts.isObjectLiteralExpression(first)) return [first];
  const containing = first && ts.isCallExpression(first) ? first.arguments[0] : undefined;
  if (first && ts.isCallExpression(first) && ts.isPropertyAccessExpression(first.expression)
    && ts.isIdentifier(first.expression.expression) && first.expression.expression.text === 'expect'
    && first.expression.name.text === 'objectContaining' && containing && ts.isObjectLiteralExpression(containing)) return [containing];
  return [];
}

/** Add only direct matcher assertions in the test module corresponding to the migrated source module. */
export function testAssertionTargetsFor(file: string, source: string, input: PlanningInput, sourceFile: string, sourceTarget: AuthorizedTarget): AuthorizedTarget[] {
  const semantics = input.change.id === 'stripe-subscription-coupon-removed' ? ({ kind: 'singleton-discount', paths: ['coupon'], destination: 'discounts' } as PatchTransformation) : undefined;
  if (!isStripeCouponMigration(input, semantics) || !isRelatedTestFile(file, sourceFile) || !/^\s*coupon\s*:/.test(sourceTarget.expected)) return [];
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const targets: AuthorizedTarget[] = [];
  const seen = new Set<string>();
  const add = (node: ts.PropertyAssignment): void => {
    const start = node.getStart(parsed); const end = node.end; const key = `${start}:${end}`;
    if (seen.has(key)) return;
    const value = node.initializer;
    if (!(ts.isIdentifier(value) || (ts.isStringLiteral(value) && value.text.length > 0)) || value.getText(parsed) === 'undefined') return;
    seen.add(key);
    targets.push({ targetId: `test-target-${targets.length}-${sourceTarget.targetId}`, path: file, symbol: sourceTarget.symbol, originalDigest: sha256(source), operation: 'replace-range', start, end, expected: source.slice(start, end), replacement: `discounts: [{ coupon: ${value.getText(parsed)} }]`, evidenceIds: [...sourceTarget.evidenceIds] });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      for (const object of assertionObjects(node, sourceTarget.symbol)) {
        const properties = object.properties.filter(ts.isPropertyAssignment);
        if (properties.some((property) => !ts.isIdentifier(property.name))) continue;
        const coupon = properties.filter((property) => property.name.getText(parsed) === 'coupon');
        if (coupon.length !== 1 || properties.some((property) => ['discounts', 'promotion_code'].includes(property.name.getText(parsed)))) continue;
        add(coupon[0]!);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return targets;
}

export function targetsFor(file: string, source: string, input: PlanningInput, digest: string, semantics?: PatchTransformation): AuthorizedTarget[] {
  if (!semantics) return [];
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const targets: AuthorizedTarget[] = [];
  for (const impact of input.impacts.filter((item) => item.location.file === file)) {
    const at = parsed.getPositionOfLineAndCharacter(impact.location.start.line - 1, impact.location.start.column - 1);
    const add = (node: ts.Node, replacement: string) => {
      const start = node.getStart(parsed); const end = node.end;
      if (targets.some((target) => target.start === start && target.end === end)) return;
      targets.push({ targetId: `target-${targets.length}-${impact.usageId}`, path: file, symbol: impact.symbol, originalDigest: digest, operation: 'replace-range', start, end, expected: source.slice(start, end), replacement, evidenceIds: [`impact:${impact.usageId}`, `change:${input.change.id}`] });
    };
    const visit = (node: ts.Node): void => {
      // Scan evidence may identify the affected member/property within the
      // call rather than the call's opening token. Accept the smallest
      // authorized enclosing call/type node, while the exact source digest,
      // file and symbol still remain mandatory provenance.
      const nodeLine = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
      if ((node.getStart(parsed) <= at && node.end >= at) || (nodeLine === impact.location.start.line && (ts.isCallExpression(node) || ts.isTypeReferenceNode(node)))) {
        if (semantics.kind === 'singleton-discount' && ts.isCallExpression(node)) {
          const rules = input.change.rules.filter((rule) => rule.kind === 'parameter' && rule.symbol === impact.symbol);
          for (const rule of rules) {
            if (rule.kind !== 'parameter' || !semantics.paths.includes(rule.path) || rule.replacementPath !== semantics.destination) continue;
            const rawArg = node.arguments[rule.argumentIndex];
            const arg = rawArg && ts.isAsExpression(rawArg) ? rawArg.expression : rawArg;
            if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
            if (arg.properties.some((p) => !ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name))) continue;
            const props = arg.properties.filter(ts.isPropertyAssignment);
            const selected = props.filter((p) => p.name.getText(parsed) === rule.path);
            if (selected.length !== 1 || props.some((p) => semantics.rejectSiblings.includes(p.name.getText(parsed)) && p.name.getText(parsed) !== rule.path)) continue;
            const prop = selected[0]!; const value = prop.initializer;
            if (!(ts.isIdentifier(value) || (ts.isStringLiteral(value) && value.text.length > 0)) || value.getText(parsed) === 'undefined') continue;
            add(prop, `${semantics.destination}: [{ ${rule.path}: ${value.getText(parsed)} }]`);
          }
        }
        if (semantics.kind === 'member-rename' && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const member = node.expression;
          if (impact.symbol === `${semantics.receiver}.${semantics.from}` && member.name.text === semantics.from && input.change.rules.some((r) => r.kind === 'method' && r.symbol === impact.symbol && r.replacementSymbol === `${semantics.receiver}.${semantics.to}`)) add(member.name, semantics.to);
        }
        if (semantics.kind === 'qualified-type-rename' && ts.isTypeReferenceNode(node) && ts.isQualifiedName(node.typeName) && node.typeName.right.text === semantics.from && input.change.rules.some((rule) => rule.kind === 'type' && rule.symbol === semantics.from && rule.replacementSymbol === semantics.to)) add(node.typeName.right, semantics.to);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return targets;
}
