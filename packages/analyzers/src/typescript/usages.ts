import { createHash } from 'node:crypto';
import { Node, SyntaxKind } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import type { ProviderDescriptor } from '@apiproof/core';
import type { UsageFinding } from '@apiproof/shared';
import { BindingResolver } from './bindings.js';
import type { Binding } from './bindings.js';
import type { RepositorySnapshot } from './repository.js';
import { location } from './locations.js';
import { extractArguments } from './arguments.js';
import { ResponseResolver } from './responses.js';
import { memberSemantics } from './semantics.js';

function context(node: Node): UsageFinding['context'] {
  let functionName: string | null = null;
  let className: string | null = null;
  for (const ancestor of node.getAncestors()) {
    if (functionName === null) {
      if (Node.isFunctionDeclaration(ancestor) || Node.isFunctionExpression(ancestor)) functionName = ancestor.getName() ?? '<anonymous>';
      else if (Node.isMethodDeclaration(ancestor) || Node.isGetAccessorDeclaration(ancestor) || Node.isSetAccessorDeclaration(ancestor)) functionName = ancestor.getName();
      else if (Node.isConstructorDeclaration(ancestor)) functionName = 'constructor';
      else if (Node.isArrowFunction(ancestor)) {
        const parent = ancestor.getParent();
        functionName = Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent) || Node.isPropertyDeclaration(parent)
          ? parent.getName() : '<anonymous>';
      }
    }
    if (className === null && (Node.isClassDeclaration(ancestor) || Node.isClassExpression(ancestor))) className = ancestor.getName() ?? '<anonymous>';
  }
  return { function: functionName, class: className };
}

function isProviderModule(name: string, packageName: string): boolean {
  return name === packageName || name.startsWith(`${packageName}/`);
}

export function detectUsages(sources: SourceFile[], provider: ProviderDescriptor, snapshot: RepositorySnapshot): UsageFinding[] {
  const resolver = new BindingResolver(provider);
  const responses = new ResponseResolver(resolver);
  const clientSymbol = provider.constructorExports.find((name) => name !== 'default') ?? provider.packageName;
  const nodes = sources.flatMap((source) => source.getDescendants());
  resolver.markWrites(nodes);
  for (const node of resolver.mutatedProviderNodes) snapshot.warn('MUTATED_BINDING', 'A provider binding is reassigned; usages through it cannot be resolved reliably.', location(node).file);
  const usages = new Map<string, UsageFinding>();
  const add = (node: Node, kind: UsageFinding['kind'], symbol: string, binding: Binding,
    details: Pick<UsageFinding, 'arguments' | 'response' | 'semantics' | 'dynamic' | 'apiVersion'> = {}) => {
    const loc = location(node);
    const id = createHash('sha256').update(JSON.stringify([provider.id, kind, symbol, loc])).digest('hex').slice(0, 24);
    usages.set(id, { id, provider: provider.id, kind, symbol, location: loc, context: context(node),
      evidence: { binding: location(binding.origin), basis: binding.basis }, confidence: Math.min(binding.basis === 'type-annotation' ? 0.85 : 0.95,
        details.arguments?.some((argument) => argument.builders?.length) || details.response?.callbackLocation ? 0.9 : 0.95), ...details });
  };
  for (const node of nodes) {
    if (Node.isImportDeclaration(node) && /^[@~]\//.test(node.getModuleSpecifierValue()) && !node.getModuleSpecifierSourceFile()) {
      snapshot.warn('UNRESOLVED_IMPORT_ALIAS', 'A local-style module alias cannot be resolved without customer configuration.', location(node).file);
    }
    if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      if (!resolver.resolve(callee) && node.getArguments().some((argument) => {
        const response = responses.resolve(argument);
        return response && !response.response.fieldPath;
      })) snapshot.warn('UNRESOLVED_RESPONSE_FLOW', 'A provider response enters an unmodeled helper; its return provenance is not inferred.', location(node).file);
      if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'then' &&
        node.getArguments().some((argument) => Node.isArrowFunction(argument) || Node.isFunctionExpression(argument)) && !responses.promise(callee.getExpression())) {
        snapshot.warn('UNRESOLVED_PROMISE_CALLBACK', 'Callback fulfillment provenance is not proven; no provider response is inferred.', location(node).file);
      }
    }
    if (Node.isImportDeclaration(node) && isProviderModule(node.getModuleSpecifierValue(), provider.packageName)) {
      const moduleName = node.getModuleSpecifierValue();
      const binding = { kind: 'sdk' as const, path: [], origin: node.getModuleSpecifier(), basis: 'import-binding' as const };
      add(node.getModuleSpecifier(), 'import', provider.packageName, binding);
      if (moduleName !== provider.packageName) add(node.getModuleSpecifier(), 'resource', moduleName, binding);
    } else if (Node.isImportEqualsDeclaration(node)) {
      const binding = resolver.resolve(node);
      if (binding) add(node, 'import', provider.packageName, binding);
    } else if (Node.isNewExpression(node) || Node.isCallExpression(node)) {
      const binding = resolver.resolve(node);
      if (binding?.kind === 'sdk' && binding.origin === node) {
        // Capture the module string, never require arguments or credentials.
        add(Node.isCallExpression(node) ? node.getArguments()[0] ?? node : node, 'import', provider.packageName, binding);
      } else if (binding?.kind === 'client') {
        add(node.getExpression(), 'construction', clientSymbol, binding, binding.apiVersion ? { apiVersion: binding.apiVersion } : {});
      }
      else if (Node.isCallExpression(node) || Node.isNewExpression(node)) {
        const callee = resolver.resolve(node.getExpression());
        if (callee?.kind === 'client' && callee.path.length) add(node.getExpression(), 'method', callee.path.join('.'), callee,
          { arguments: extractArguments(node.getArguments(), resolver), semantics: memberSemantics(node.getExpression()), ...(callee.apiVersion ? { apiVersion: callee.apiVersion } : {}) });
        if (Node.isCallExpression(node) && node.getExpression().getKind() === SyntaxKind.ImportKeyword) {
          const argument = node.getArguments()[0];
          if (argument && Node.isStringLiteral(argument) && argument.getLiteralValue() === provider.packageName) {
            snapshot.warn('DYNAMIC_IMPORT', 'Dynamic provider imports are not resolved in Phase 1.', location(node).file);
            add(argument, 'import', provider.packageName, { kind: 'sdk', path: [], origin: argument, basis: 'import-binding' });
          }
        }
      }
    } else if (Node.isTypeReference(node)) {
      const binding = resolver.resolve(node);
      if (binding) add(node.getTypeName(), 'type', binding.path.join('.') || clientSymbol, binding);
    } else if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
      const response = responses.resolve(node);
      if (response?.response.fieldPath) add(node, 'response-field', response.response.fieldPath, response.binding, { response: response.response });
      if (Node.isElementAccessExpression(node)) {
        const base = resolver.resolve(node.getExpression());
        if (base?.kind === 'client' && !resolver.resolve(node)) snapshot.warn('DYNAMIC_MEMBER', 'Computed provider member cannot be resolved statically.', location(node).file);
        const responseBase = !response ? responses.resolve(node.getExpression()) : undefined;
        if (responseBase) {
          snapshot.warn('DYNAMIC_RESPONSE_FIELD', 'Computed response field cannot be resolved statically.', location(node).file);
          add(node, 'response-field', '<dynamic-response-field>', responseBase.binding, { response: { ...responseBase.response, fieldPath: '' }, dynamic: true });
        }
      }
      const parent = node.getParent();
      if ((Node.isPropertyAccessExpression(parent) || Node.isElementAccessExpression(parent) || Node.isCallExpression(parent) || Node.isNewExpression(parent)) && parent.getExpression() === node) continue;
      const binding = resolver.resolve(node);
      if (binding?.kind === 'client' && binding.path.length) {
        // Method references are potential invocations; aliases are followed at their call sites too.
        add(node, binding.path.length === 1 ? 'resource' : 'method', binding.path.join('.'), binding,
          { semantics: memberSemantics(node, binding.path.length === 1) });
      }
    } else if (Node.isBindingElement(node)) {
      const response = responses.resolve(node);
      if (response?.response.fieldPath) add(node.getPropertyNameNode() ?? node.getNameNode(), 'response-field', response.response.fieldPath, response.binding, { response: response.response });
    }
  }
  return [...usages.values()].sort((a, b) => a.location.file.localeCompare(b.location.file, 'en') ||
    a.location.start.line - b.location.start.line || a.location.start.column - b.location.start.column || a.kind.localeCompare(b.kind));
}
