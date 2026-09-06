import { Node, VariableDeclarationKind } from 'ts-morph';

/** Resolve immutable scalar aliases only; never evaluate expressions or call code. */
export function staticString(node: Node | undefined, written: (node: Node) => boolean, depth = 0): string | undefined {
  if (!node || depth > 8 || written(node)) return undefined;
  if (Node.isStringLiteral(node)) return node.getLiteralValue();
  if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node) || Node.isSatisfiesExpression(node)) return staticString(node.getExpression(), written, depth + 1);
  if (!Node.isIdentifier(node)) return undefined;
  const symbol = node.getSymbol();
  const declarations = symbol?.getAliasedSymbol()?.getDeclarations() ?? symbol?.getDeclarations() ?? [];
  if (declarations.length !== 1) return undefined;
  const declaration = declarations[0];
  if (!declaration || !Node.isVariableDeclaration(declaration) || written(declaration) ||
      declaration.getVariableStatement()?.getDeclarationKind() !== VariableDeclarationKind.Const) return undefined;
  return staticString(declaration.getInitializer(), written, depth + 1);
}

export function unwrap(node: Node): Node {
  while (Node.isParenthesizedExpression(node) || Node.isAsExpression(node) || Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node) || Node.isTypeAssertion(node)) node = node.getExpression();
  return node;
}
