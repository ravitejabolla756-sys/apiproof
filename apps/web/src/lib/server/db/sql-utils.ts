/**
 * Translates positional parameter placeholders from SQLite style (?)
 * to PostgreSQL style ($1, $2, $3, ...).
 *
 * Safely ignores '?' occurrences inside single-quoted string literals,
 * double-quoted identifiers, line comments (--), and block comments.
 */
export function translatePlaceholders(sql: string): string {
  let result = '';
  let paramIndex = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inLineComment) {
      result += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      result += char;
      if (char === '*' && nextChar === '/') {
        result += nextChar;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingleQuote) {
      result += char;
      if (char === "'") {
        if (nextChar === "'") {
          result += nextChar;
          i++; // escaped quote ''
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      result += char;
      if (char === '"') {
        if (nextChar === '"') {
          result += nextChar;
          i++; // escaped quote ""
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    // Check for comment starts
    if (char === '-' && nextChar === '-') {
      result += '--';
      i++;
      inLineComment = true;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      result += '/*';
      i++;
      inBlockComment = true;
      continue;
    }

    // String / identifier literal starts
    if (char === "'") {
      result += char;
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inDoubleQuote = true;
      continue;
    }

    // Replace unquoted '?' with '$n'
    if (char === '?') {
      result += `$${paramIndex++}`;
      continue;
    }

    result += char;
  }

  return result;
}
