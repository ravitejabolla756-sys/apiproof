import ts from 'typescript';
import type { PlanningInput, PatchEdit, PatchTransformation } from '@apiproof/shared';
export interface AuthorizedTarget extends PatchEdit { path: string; symbol: string; originalDigest: string }

export function syntaxValid(file: string, source: string): boolean {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length === 0;
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
      if (node.getStart(parsed) === at) {
        if (semantics.kind === 'singleton-discount' && ts.isCallExpression(node)) {
          const rules = input.change.rules.filter((rule) => rule.kind === 'parameter' && rule.symbol === impact.symbol);
          for (const rule of rules) {
            if (rule.kind !== 'parameter' || !semantics.paths.includes(rule.path) || rule.replacementPath !== semantics.destination) continue;
            const arg = node.arguments[rule.argumentIndex]; if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
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
