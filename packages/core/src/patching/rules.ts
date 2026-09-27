import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PatchRuleRegistrySchema } from '@apiproof/shared';
import { assertPlainPath } from './policy.js';

/** Fixed, bundled, digest-bound registry. Callers and model output cannot select a registry path. */
export async function loadPatchRules() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../registry/patches/transformations.json');
  await assertPlainPath(file);
  return PatchRuleRegistrySchema.parse(JSON.parse(await readFile(file, 'utf8')));
}
