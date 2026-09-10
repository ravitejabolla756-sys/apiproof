import { Node, SyntaxKind, ts } from 'ts-morph';
import type { ProviderDescriptor } from '@apiproof/core';
import { staticString } from './static-values.js';

export interface Binding {
  kind: 'sdk' | 'client' | 'type';
  path: string[];
  origin: Node;
  basis: 'import-binding' | 'require-binding' | 'type-annotation';
}

function importDeclaration(node: Node) {
  return node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
}
function key(node: Node): string { return `${node.getSourceFile().getFilePath()}:${node.getStart()}:${node.getEnd()}:${node.getKind()}`; }

/** Bounded declaration following; deliberately not a whole-program dataflow engine. */
export class BindingResolver {
  private readonly cache = new Map<string, Binding | null>();
  private readonly active = new Set<string>();
  private readonly written = new Set<string>();
  readonly mutatedProviderNodes: Node[] = [];

  constructor(private readonly provider: ProviderDescriptor) {}

  isWritten(node: Node): boolean {
    return this.written.has(key(node)) || (node.getSymbol()?.getDeclarations() ?? []).some((declaration) => this.written.has(key(declaration)));
  }

  markWrites(nodes: Node[]): void {
    const writes: Node[] = [];
    for (const node of nodes) {
      if (Node.isBinaryExpression(node)) {
        const operator = node.getOperatorToken().getKind();
        if (operator >= ts.SyntaxKind.FirstAssignment && operator <= ts.SyntaxKind.LastAssignment) {
          // A direct constructor initialization of this.property is normal class setup.
          const left = node.getLeft();
          const right = this.resolve(node.getRight());
          if (operator === SyntaxKind.EqualsToken && Node.isPropertyAccessExpression(left) &&
              left.getExpression().getKind() === SyntaxKind.ThisKeyword && node.getFirstAncestorByKind(SyntaxKind.Constructor) &&
              right?.kind === 'client' && right.path.length === 0) continue;
          writes.push(left);
        }
      } else if (Node.isPrefixUnaryExpression(node) || Node.isPostfixUnaryExpression(node)) {
        if ([SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(node.getOperatorToken())) writes.push(node.getOperand());
      }
    }
    // Resolve before invalidating, so a mutation remains an explicit coverage gap.
    for (let node of writes) {
      const binding = this.resolve(node);
      if (binding) this.mutatedProviderNodes.push(node);
      for (const declaration of node.getSymbol()?.getDeclarations() ?? []) this.written.add(key(declaration));
      while (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) node = node.getExpression();
      for (const declaration of node.getSymbol()?.getDeclarations() ?? []) this.written.add(key(declaration));
    }
    this.cache.clear();
  }

  resolve(node: Node | undefined, depth = 0): Binding | undefined {
    if (!node || depth > 40) return undefined;
    const id = key(node);
    if (this.cache.has(id)) return this.cache.get(id) ?? undefined;
    if (this.active.has(id) || this.written.has(id)) return undefined;
    this.active.add(id);
    let result: Binding | undefined;
    try { result = this.resolveNode(node, depth); }
    finally { this.active.delete(id); }
    this.cache.set(id, result ?? null);
    return result;
  }

  private resolveNode(node: Node, depth: number): Binding | undefined {
    const next = (value: Node | undefined) => this.resolve(value, depth + 1);
    if (Node.isParenthesizedExpression(node) || Node.isNonNullExpression(node) || Node.isSatisfiesExpression(node)) return next(node.getExpression());
    if (Node.isAsExpression(node) || Node.isTypeAssertion(node)) {
      return next(node.getExpression()) ?? this.fromAnnotation(node.getTypeNode(), depth);
    }
    if (Node.isImportClause(node)) {
      const declaration = importDeclaration(node);
      if (declaration?.getModuleSpecifierValue() === this.provider.packageName) return this.sdk(node, 'import-binding');
    }
    if (Node.isNamespaceImport(node) || Node.isImportSpecifier(node)) {
      const declaration = importDeclaration(node);
      if (declaration?.getModuleSpecifierValue() === this.provider.packageName) {
        const name = Node.isImportSpecifier(node) ? node.getName() : 'default';
        return this.provider.constructorExports.includes(name) ? this.sdk(node, 'import-binding')
          : { kind: 'type', path: [name], origin: node, basis: 'import-binding' };
      }
    }
    if (Node.isImportEqualsDeclaration(node)) {
      const reference = node.getModuleReference();
      if (Node.isExternalModuleReference(reference)) {
        const expression = reference.getExpression();
        if (expression && Node.isStringLiteral(expression) && expression.getLiteralValue() === this.provider.packageName) {
          return this.sdk(node, 'require-binding');
        }
      }
    }
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      const first = node.getArguments()[0];
      if (Node.isIdentifier(expression) && expression.getText() === 'require' && first &&
          Node.isStringLiteral(first) && first.getLiteralValue() === this.provider.packageName &&
          !(expression.getSymbol()?.getDeclarations().length)) {
        return this.sdk(node, 'require-binding');
      }
      const callee = next(expression);
      if (callee?.kind === 'sdk' && callee.path.length === 0) return { ...callee, kind: 'client' };
      return undefined;
    }
    if (Node.isNewExpression(node)) {
      const constructor = next(node.getExpression());
      if (constructor?.kind === 'sdk' && constructor.path.length === 0) return { ...constructor, kind: 'client' };
      return undefined;
    }
    if (Node.isVariableDeclaration(node) || Node.isPropertyDeclaration(node) || Node.isParameterDeclaration(node)) {
      return next(node.getInitializer()) ?? this.fromAnnotation(node.getTypeNode(), depth);
    }
    if (Node.isPropertyAssignment(node)) return next(node.getInitializer());
    if (Node.isShorthandPropertyAssignment(node)) {
      const symbol = node.getValueSymbol();
      for (const declaration of symbol?.getDeclarations() ?? []) {
        const result = next(declaration);
        if (result) return result;
      }
    }
    if (Node.isBindingElement(node)) {
      const pattern = node.getParent();
      if (!Node.isObjectBindingPattern(pattern) || node.getDotDotDotToken()) return undefined;
      const declaration = pattern.getParent();
      const base = next(declaration);
      const property = node.getPropertyNameNode() ?? node.getNameNode();
      if (base && (Node.isIdentifier(property) || Node.isStringLiteral(property))) {
        const name = Node.isStringLiteral(property) ? property.getLiteralValue() : property.getText();
        return this.member(base, name);
      }
    }
    if (Node.isQualifiedName(node)) {
      const base = next(node.getLeft());
      return base ? this.member(base, node.getRight().getText()) : undefined;
    }
    if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
      const base = next(node.getExpression());
      const argument = Node.isElementAccessExpression(node) ? node.getArgumentExpression() : undefined;
      const name = Node.isPropertyAccessExpression(node) ? node.getName()
        : staticString(argument, (value) => this.isWritten(value));
      if (base && name !== undefined) return this.member(base, name);
      // Handles this.stripe and properties of local objects, using the compiler's symbol table.
    }
    if (Node.isTypeReference(node)) return next(node.getTypeName());
    if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node) || Node.isImportSpecifier(node) || Node.isImportClause(node)) {
      const symbol = node.getSymbol();
      for (const declaration of symbol?.getDeclarations() ?? []) {
        if (declaration === node) continue;
        const result = next(declaration);
        if (result) return result;
      }
      for (const declaration of symbol?.getAliasedSymbol()?.getDeclarations() ?? []) {
        if (declaration === node) continue;
        const result = next(declaration);
        if (result) return result;
      }
    }
    return undefined;
  }

  private fromAnnotation(node: Node | undefined, depth: number): Binding | undefined {
    const binding = this.resolve(node, depth + 1);
    return binding ? { ...binding, kind: binding.kind === 'sdk' ? 'client' : binding.kind, basis: 'type-annotation' } : undefined;
  }

  private member(base: Binding, name: string): Binding {
    if (base.kind === 'sdk' && this.provider.constructorExports.includes(name)) return base;
    return { ...base, kind: base.kind === 'sdk' ? (this.provider.id === 'twilio' ? 'client' : 'type') : base.kind, path: [...base.path, name] };
  }

  private sdk(origin: Node, basis: Binding['basis']): Binding { return { kind: 'sdk', path: [], origin, basis }; }
}
