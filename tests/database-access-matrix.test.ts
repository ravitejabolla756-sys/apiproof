import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const databaseSourceDirectory = path.resolve(process.cwd(), 'apps/web/src/lib/server/db');
const accessMatrixPath = path.resolve(process.cwd(), 'docs/v1-member1-db-access-matrix.md');

function sourceTableNames(): Set<string> {
  const names = new Set<string>();
  for (const fileName of fs.readdirSync(databaseSourceDirectory).filter((name) => name.endsWith('.ts'))) {
    const source = fs.readFileSync(path.join(databaseSourceDirectory, fileName), 'utf8');
    for (const match of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_][a-z0-9_]*)/gi)) {
      names.add(match[1]!.toLowerCase());
    }
  }
  return names;
}

function documentedTableNames(): string[] {
  const lines = fs.readFileSync(accessMatrixPath, 'utf8').split(/\r?\n/);
  const names: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## Current role and grant matrix')) break;
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (match) names.push(match[1]!.toLowerCase());
  }
  return names;
}

describe('database access matrix source inventory', () => {
  it('documents every table defined by the database schema and migrations exactly once', () => {
    const source = sourceTableNames();
    const documented = documentedTableNames();

    expect(documented.sort()).toEqual([...source].sort());
  });
});
