import { Node, SyntaxKind } from 'ts-morph';
import type { UsageFinding } from '@apiproof/shared';

/** Expression context is a generic fact; providers decide which contexts matter. */
export function memberSemantics(node: Node, resource = false): UsageFinding['semantics'] {
  let current = node;
  for (let depth = 0; depth < 12; depth++) {
    const parent = current.getParent();
    if (!parent) break;
    if (Node.isParenthesizedExpression(parent) || Node.isAsExpression(parent) || Node.isNonNullExpression(parent) || Node.isSatisfiesExpression(parent)) { current = parent; continue; }
    if (Node.isCallExpression(parent) && parent.getExpression() === current) {
      const optional = parent.hasQuestionDotToken() || current.getDescendants().some((part) => part.getKind() === SyntaxKind.QuestionDotToken);
      return optional ? 'optional-invocation' : 'invocation';
    }
    if (Node.isCallExpression(parent) && parent.getArguments()[0] === current) {
      const callee = parent.getExpression();
      if (Node.isIdentifier(callee) && callee.getText() === 'Boolean' && !callee.getSymbol()?.getDeclarations().length) return 'capability-check';
    }
    if (Node.isTypeOfExpression(parent)) return 'capability-check';
    if (Node.isPrefixUnaryExpression(parent) && parent.getOperatorToken() === SyntaxKind.ExclamationToken) return 'capability-check';
    if ((Node.isIfStatement(parent) || Node.isWhileStatement(parent) || Node.isDoStatement(parent)) && parent.getExpression() === current) return 'capability-check';
    if (Node.isConditionalExpression(parent) && parent.getCondition() === current) return 'capability-check';
    if (Node.isBinaryExpression(parent)) {
      const op = parent.getOperatorToken().getKind();
      if ([SyntaxKind.EqualsEqualsToken, SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.ExclamationEqualsToken, SyntaxKind.ExclamationEqualsEqualsToken].includes(op)) {
        const other = parent.getLeft() === current ? parent.getRight() : parent.getLeft();
        if (Node.isNullLiteral(other) || other.getKind() === SyntaxKind.UndefinedKeyword ||
          (Node.isIdentifier(other) && other.getText() === 'undefined' && !other.getSymbol()?.getDeclarations().length)) return 'capability-check';
      }
      if (op === SyntaxKind.AmpersandAmpersandToken && parent.getLeft() === current) return 'capability-check';
      if (op === SyntaxKind.InKeyword && parent.getRight() === current) return 'capability-check';
      if ([SyntaxKind.BarBarToken, SyntaxKind.AmpersandAmpersandToken].includes(op)) { current = parent; continue; }
    }
    break;
  }
  return resource ? 'property-access' : 'method-reference';
}
