import { Node, VariableDeclarationKind } from 'ts-morph';
import type { ArgumentFact } from '@apiproof/shared';
import { literalHash } from '@apiproof/shared';
import type { BindingResolver } from './bindings.js';
import { location } from './locations.js';
import { resolveBuilder } from './builders.js';

function propertyName(node: Node): string | undefined {
  return Node.isIdentifier(node) ? node.getText() : Node.isStringLiteral(node) ? node.getLiteralValue() : undefined;
}

function hashLiteral(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return literalHash(node.getLiteralValue());
  if (Node.isNumericLiteral(node)) return literalHash(node.getLiteralValue());
  if (Node.isTrueLiteral(node)) return literalHash(true);
  if (Node.isFalseLiteral(node)) return literalHash(false);
  if (Node.isNullLiteral(node)) return literalHash(null);
  return undefined;
}

/** Extract names and literal fingerprints, never argument values or source snippets. */
export function extractArguments(args: Node[], bindings: BindingResolver): ArgumentFact[] {
  return args.map((argument, index) => {
    const properties = new Map<string, ArgumentFact['properties'][number]>();
    let complete = true;
    const active = new Set<Node>();
    const builders: NonNullable<ArgumentFact['builders']> = [];
    let builderDepth = 0;
    const visit = (node: Node | undefined, prefix = '', depth = 0): void => {
      if (!node || depth > 20 || active.has(node) || bindings.isWritten(node)) { complete = false; return; }
      active.add(node);
      try {
        if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) return visit(node.getExpression(), prefix, depth + 1);
        if (Node.isCallExpression(node)) {
          const builder = builderDepth < 3 ? resolveBuilder(node, bindings) : undefined;
          if (!builder || active.has(builder.fn)) { complete = false; return; }
          active.add(builder.fn);
          builders.push({ sourceFunction: node.getExpression().getText(), definition: location(builder.fn), callSite: location(node) });
          builderDepth++;
          try { visit(builder.value, prefix, depth + 1); }
          finally { builderDepth--; active.delete(builder.fn); }
          return;
        }
        if (Node.isIdentifier(node)) {
          const symbol = node.getSymbol();
          const declarations = symbol?.getAliasedSymbol()?.getDeclarations() ?? symbol?.getDeclarations() ?? [];
          const declaration = declarations.find(Node.isVariableDeclaration);
          if (declaration?.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const) return visit(declaration.getInitializer(), prefix, depth + 1);
          complete = false;
          return;
        }
        if (!Node.isObjectLiteralExpression(node)) { complete = false; return; }
        for (const property of node.getProperties()) {
          if (Node.isSpreadAssignment(property)) {
            visit(property.getExpression(), prefix, depth + 1);
            // Even known spreads preserve exact property locations in their declaration.
            continue;
          }
          if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) { complete = false; continue; }
          const name = propertyName(property.getNameNode());
          if (name === undefined) { complete = false; continue; }
          const key = prefix ? `${prefix}.${name}` : name;
          for (const old of properties.keys()) if (old === key || old.startsWith(`${key}.`)) properties.delete(old);
          const value = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
          const hash = hashLiteral(value);
          properties.set(key, { path: key, location: location(property.getNameNode()), ...(hash ? { literalHash: hash } : {}) });
          if (value && Node.isObjectLiteralExpression(value)) visit(value, key, depth + 1);
        }
      } finally { active.delete(node); }
    };
    visit(argument);
    return { index, complete, properties: [...properties.values()], ...(builders.length ? { builders } : {}) };
  });
}
