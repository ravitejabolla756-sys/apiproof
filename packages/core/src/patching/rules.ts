import { readFile } from 'node:fs/promises';
import { PatchRuleRegistrySchema } from '@apiproof/shared';
import { resolveBundledResource } from './workspace.js';

/** Fixed, bundled, digest-bound registry. Callers and model output cannot select a registry path. */
export async function loadPatchRules() {
  const file = await resolveBundledResource('registry', 'patches', 'transformations.json');
  return PatchRuleRegistrySchema.parse(JSON.parse(await readFile(file, 'utf8')));
}
