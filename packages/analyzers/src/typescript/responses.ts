import { Node, VariableDeclarationKind } from 'ts-morph';
import type { UsageFinding } from '@apiproof/shared';
import type { Binding, BindingResolver } from './bindings.js';
import { location } from './locations.js';
import { staticString, unwrap } from './static-values.js';

interface ResponseBinding {
  binding: Binding;
  response: NonNullable<UsageFinding['response']>;
}

/** Bounded response provenance, with Promise and fulfilled-value states kept separate. */
export class ResponseResolver {
  constructor(private readonly bindings: BindingResolver) {}

  resolve(node: Node | undefined, active = new Set<Node>(), depth = 0): ResponseBinding | undefined {
    if (!node || active.has(node) || depth > 25 || this.bindings.isWritten(node)) return undefined;
    active.add(node);
    const next = (value: Node | undefined) => this.resolve(value, active, depth + 1);
    try {
      if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node) || Node.isNonNullExpression(node)) return next(node.getExpression());
      if (Node.isAwaitExpression(node)) {
        return this.promise(node.getExpression());
      }
      if (Node.isParameterDeclaration(node)) {
        const callback = node.getParent();
        if (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback)) {
          const call = callback.getParent();
          if (Node.isCallExpression(call) && call.getArguments()[0] === callback && callback.getParameters()[0] === node) {
            const callee = call.getExpression();
            if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'then') {
              const origin = this.promise(callee.getExpression());
              if (origin) return { ...origin, response: { ...origin.response, callbackLocation: location(node) } };
            }
          }
        }
      }
      if (Node.isVariableDeclaration(node)) {
        if (node.getVariableStatement()?.getDeclarationKind() !== VariableDeclarationKind.Const) return undefined;
        const result = next(node.getInitializer());
        if (result) return result;
      }
      if (Node.isBindingElement(node)) {
        const pattern = node.getParent();
        if (!Node.isObjectBindingPattern(pattern) || node.getDotDotDotToken()) return undefined;
        const base = next(pattern.getParent());
        const name = node.getPropertyNameNode() ?? node.getNameNode();
        if (base && (Node.isIdentifier(name) || Node.isStringLiteral(name))) return this.member(base, Node.isIdentifier(name) ? name.getText() : name.getLiteralValue());
      }
      if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
        const base = next(node.getExpression());
        const argument = Node.isElementAccessExpression(node) ? node.getArgumentExpression() : undefined;
        const name = Node.isPropertyAccessExpression(node) ? node.getName() : staticString(argument, (value) => this.bindings.isWritten(value));
        return base && name ? this.member(base, name) : undefined;
      }
      if (Node.isIdentifier(node)) {
        const symbol = node.getSymbol();
        for (const declaration of symbol?.getAliasedSymbol()?.getDeclarations() ?? symbol?.getDeclarations() ?? []) {
          const result = next(declaration);
          if (result) return result;
        }
      }
      if (Node.isParameterDeclaration(node) || Node.isVariableDeclaration(node) || Node.isPropertyDeclaration(node)) {
        const binding = this.bindings.resolve(node.getTypeNode());
        if (binding?.kind === 'type' && binding.path.length) return { binding: { ...binding, basis: 'type-annotation' },
          response: { originKind: 'type', originSymbol: binding.path.join('.'), fieldPath: '', originLocation: location(node.getTypeNodeOrThrow()) } };
      }
      return undefined;
    } finally { active.delete(node); }
  }

  promise(input: Node | undefined, depth = 0): ResponseBinding | undefined {
    if (!input || depth > 8 || this.bindings.isWritten(input)) return undefined;
    const node = unwrap(input);
    if (Node.isIdentifier(node)) {
      const declarations = node.getSymbol()?.getDeclarations() ?? [];
      const declaration = declarations.length === 1 ? declarations[0] : undefined;
      if (declaration && Node.isVariableDeclaration(declaration) && !this.bindings.isWritten(declaration) &&
          declaration.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const) return this.promise(declaration.getInitializer(), depth + 1);
    }
    if (!Node.isCallExpression(node)) return undefined;
    const binding = this.bindings.resolve(node.getExpression());
    if (binding?.kind !== 'client' || !binding.path.length) return undefined;
    return { binding, response: { originKind: 'method', originSymbol: binding.path.join('.'), fieldPath: '', originLocation: location(node.getExpression()) } };
  }

  private member(base: ResponseBinding, name: string): ResponseBinding {
    return { ...base, response: { ...base.response, fieldPath: [base.response.fieldPath, name].filter(Boolean).join('.') } };
  }
}
