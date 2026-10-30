import type { Node } from 'ts-morph';
import type { CodeLocation } from '@apiproof/shared';

export function location(node: Node): CodeLocation {
  const source = node.getSourceFile();
  return { file: source.getFilePath().replace(/^\/repository\//, ''),
    start: source.getLineAndColumnAtPos(node.getStart()), end: source.getLineAndColumnAtPos(node.getEnd()) };
}
