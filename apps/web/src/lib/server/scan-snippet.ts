export function extractSourceSnippet(fileContent: string, lineNumber: number, contextLines = 3): string {
  const lines = fileContent.split('\n');
  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length, lineNumber + contextLines);
  return lines.slice(start, end).map((line, index) => {
    const current = start + index + 1;
    return `${current === lineNumber ? '>' : ' '} ${current.toString().padStart(4, ' ')} | ${line}`;
  }).join('\n');
}
