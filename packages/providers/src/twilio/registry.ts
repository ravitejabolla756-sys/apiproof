import { readdir } from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import { AnalysisError, RegistryChangeSchema, readJsonFile } from '@apiproof/shared';
import type { RegistryChange } from '@apiproof/shared';

function officialUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && (
    url.hostname === 'docs.twilio.com' ||
    url.hostname === 'www.twilio.com' ||
    url.hostname === 'twilio.com' ||
    (url.hostname === 'github.com' && url.pathname.startsWith('/twilio/twilio-node/')) ||
    (url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith('/twilio/twilio-node/'))
  );
}

export function validateRegistryChange(input: unknown, requireReviewed = true): RegistryChange {
  const parsed = RegistryChangeSchema.safeParse(input);
  if (!parsed.success) throw new AnalysisError('INVALID_REGISTRY_CHANGE', 'Registry record lacks valid rules, evidence, or review metadata.');
  const change = parsed.data;
  if (change.provider !== 'twilio' || change.packageName !== 'twilio' || change.evidenceSources.some((source) => !officialUrl(source.url))) {
    throw new AnalysisError('INVALID_REGISTRY_EVIDENCE', 'Twilio records require official Twilio documentation or twilio-node evidence URLs.');
  }
  if (change.affectedSdkVersions && !semver.validRange(change.affectedSdkVersions)) throw new AnalysisError('INVALID_VERSION_RANGE', 'Registry SDK range is invalid.');
  if (change.targetSdkVersion && !semver.valid(change.targetSdkVersion)) throw new AnalysisError('INVALID_TARGET_VERSION', 'Registry target SDK must be exact.');
  if (requireReviewed && change.review.status === 'draft') throw new AnalysisError('UNREVIEWED_CHANGE', 'Draft records cannot be used for impact analysis or evaluation.');
  return change;
}

export async function loadTwilioRegistry(directory: string): Promise<RegistryChange[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { throw new AnalysisError('INVALID_REGISTRY', 'Registry directory cannot be read.'); }
  const files = entries.filter((entry) => entry.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length || files.length > 100) throw new AnalysisError('INVALID_REGISTRY', 'Registry must contain between 1 and 100 JSON records.');
  const records: RegistryChange[] = [];
  for (const file of files) {
    const record = validateRegistryChange(await readJsonFile(path.join(directory, file.name), directory), false);
    if (records.some((entry) => entry.id === record.id)) throw new AnalysisError('DUPLICATE_CHANGE', 'Registry change IDs must be unique.');
    records.push(record);
  }
  return records;
}
