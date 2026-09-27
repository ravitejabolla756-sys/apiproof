import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadStripeRegistry, loadTwilioRegistry } from '@apiproof/providers';
import type { ApiChange } from '@apiproof/shared';

export function resolveRegistryDirectory(providerName: 'stripe' | 'twilio'): string {
  const candidates = [
    path.resolve(process.cwd(), 'registry', providerName),
    path.resolve(process.cwd(), '../../registry', providerName),
    path.resolve(process.cwd(), '..', '..', 'registry', providerName),
    fileURLToPath(new URL(`../../../../../registry/${providerName}`, import.meta.url)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(`Registry directory for provider '${providerName}' could not be located in candidate paths: ${candidates.join(', ')}`);
}

export async function loadProviderRegistry(providerName: 'stripe' | 'twilio'): Promise<ApiChange[]> {
  const dir = resolveRegistryDirectory(providerName);
  if (providerName === 'twilio') {
    return loadTwilioRegistry(dir);
  }
  return loadStripeRegistry(dir);
}
