import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MIGRATION_TEMPLATE_COVERAGE } from '@apiproof/providers';
import { RegistryChangeSchema } from '@apiproof/shared';

type BundledPatchRule = { changeDigest?: unknown };

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function findRepositoryRoot(startDirectory: string): string | undefined {
  let current = path.resolve(startDirectory);
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(path.join(current, 'registry', 'patches', 'transformations.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

/**
 * Returns only template IDs backed by a reviewed, schema-valid, immutable
 * registry change and a matching bundled patch rule. Catalog declarations do
 * not establish executable migration capability on their own.
 */
export function loadVerifiedMigrationTemplateIds(repositoryRoot: string): ReadonlySet<string> {
  const resolvedRoot = findRepositoryRoot(repositoryRoot);
  if (!resolvedRoot) return new Set();

  let rules: Record<string, BundledPatchRule>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(resolvedRoot, 'registry', 'patches', 'transformations.json'), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !('rules' in parsed) || !parsed.rules || typeof parsed.rules !== 'object') return new Set();
    rules = parsed.rules as Record<string, BundledPatchRule>;
  } catch {
    return new Set();
  }

  const verified = new Set<string>();
  for (const entry of MIGRATION_TEMPLATE_COVERAGE) {
    if (entry.status !== 'deterministic-ast') continue;
    for (const templateId of entry.templateIds) {
      const bundledRule = rules[templateId];
      const bundledChangePath = path.join(resolvedRoot, 'registry', entry.providerId, `${templateId}.json`);
      if (!bundledRule || !existsSync(bundledChangePath)) continue;
      try {
        const bundledChange = RegistryChangeSchema.parse(JSON.parse(readFileSync(bundledChangePath, 'utf8')));
        if (bundledChange.id !== templateId || bundledChange.review.status !== 'reviewed' || bundledChange.review.reviewerKind !== 'human') continue;
        if (bundledRule.changeDigest !== sha256(bundledChange)) continue;
        verified.add(templateId);
      } catch {
        // Invalid or unreadable registry assets fail closed.
      }
    }
  }
  return verified;
}
