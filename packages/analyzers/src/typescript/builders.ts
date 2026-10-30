import { Node, VariableDeclarationKind } from 'ts-morph';
import type { BindingResolver } from './bindings.js';
import { unwrap } from './static-values.js';

/** One local function with a straight-line const prelude and one return, at most. */
export function resolveBuilder(call: Node, bindings: BindingResolver) {
  if (!Node.isCallExpression(call)) return undefined;
  const callee = unwrap(call.getExpression());
  if (!Node.isIdentifier(callee) || bindings.isWritten(callee)) return undefined;
  const symbol = callee.getSymbol();
  const declarations = symbol?.getAliasedSymbol()?.getDeclarations() ?? symbol?.getDeclarations() ?? [];
  if (declarations.length !== 1) return undefined;
  let fn = declarations[0];
  if (fn && Node.isVariableDeclaration(fn)) {
    if (fn.getVariableStatement()?.getDeclarationKind() !== VariableDeclarationKind.Const || bindings.isWritten(fn)) return undefined;
    fn = fn.getInitializer();
  }
  if (!fn || !(Node.isFunctionDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn)) || fn.isAsync() ||
    ((Node.isFunctionDeclaration(fn) || Node.isFunctionExpression(fn)) && fn.isGenerator())) return undefined;
  if (fn.getParameters().some((parameter) => parameter.getInitializer() || parameter.isRestParameter())) return undefined;
  const body = fn.getBody();
  if (!body) return undefined;
  if (!Node.isBlock(body)) return { fn, value: body };
  const statements = body.getStatements();
  const last = statements.at(-1);
  if (!last || !Node.isReturnStatement(last)) return undefined;
  for (const statement of statements.slice(0, -1)) {
    if (!Node.isVariableStatement(statement) || statement.getDeclarationKind() !== VariableDeclarationKind.Const) return undefined;
    for (const declaration of statement.getDeclarations()) {
      const initializer = declaration.getInitializer();
      if (!initializer || bindings.isWritten(declaration) || initializer.getDescendants().some((node) => Node.isCallExpression(node) || Node.isNewExpression(node)) || Node.isCallExpression(initializer)) return undefined;
    }
  }
  return { fn, value: last.getExpression() };
}
