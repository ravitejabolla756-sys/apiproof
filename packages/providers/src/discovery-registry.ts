/** Discovery metadata is deliberately separate from reviewed compatibility rules. */
export type ProviderCapability = 'discovery' | 'versionAware' | 'compatibility' | 'migration' | 'verifiedMigration';

export interface ProviderDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly packageIdentifiers: readonly string[];
  readonly packagePrefixes?: readonly string[];
  readonly apiDomains: readonly string[];
  readonly environmentVariables: readonly string[];
  readonly documentation: { readonly url: string; readonly changelogUrl?: string };
  readonly capability: ProviderCapability;
  readonly allowSharedIdentifiers?: boolean;
}

export interface PackagePrefixIndex {
  lookup(packageName: string): ProviderDefinition[];
}

export interface DomainLookupIndex {
  lookup(hostname: string): ProviderDefinition[];
}

export interface ProviderRegistry {
  readonly definitions: readonly ProviderDefinition[];
  readonly exactPackageIndex: ReadonlyMap<string, readonly ProviderDefinition[]>;
  readonly packagePrefixIndex: PackagePrefixIndex;
  readonly environmentVariableIndex: ReadonlyMap<string, readonly ProviderDefinition[]>;
  readonly domainIndex: DomainLookupIndex;
}

export const DISCOVERY_PROVIDERS: readonly ProviderDefinition[] = [
  { id: 'openai', displayName: 'OpenAI', packageIdentifiers: ['openai'], apiDomains: ['api.openai.com'], environmentVariables: ['OPENAI_API_KEY'], documentation: { url: 'https://platform.openai.com/docs' }, capability: 'discovery' },
  { id: 'anthropic', displayName: 'Anthropic', packageIdentifiers: ['@anthropic-ai/sdk'], apiDomains: ['api.anthropic.com'], environmentVariables: ['ANTHROPIC_API_KEY'], documentation: { url: 'https://docs.anthropic.com/' }, capability: 'discovery' },
  { id: 'google-gemini', displayName: 'Google Gemini', packageIdentifiers: ['@google/genai', '@google/generative-ai'], apiDomains: ['generativelanguage.googleapis.com'], environmentVariables: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], documentation: { url: 'https://ai.google.dev/gemini-api/docs' }, capability: 'discovery' },
  { id: 'github', displayName: 'GitHub', packageIdentifiers: ['@octokit/rest', '@octokit/core', 'octokit'], apiDomains: ['api.github.com'], environmentVariables: ['GITHUB_TOKEN'], documentation: { url: 'https://docs.github.com/en/rest' }, capability: 'discovery' },
  { id: 'aws', displayName: 'AWS', packageIdentifiers: ['aws-sdk'], packagePrefixes: ['@aws-sdk/client-'], apiDomains: [], environmentVariables: ['AWS_ACCESS_KEY_ID', 'AWS_REGION'], documentation: { url: 'https://docs.aws.amazon.com/sdk-for-javascript/' }, capability: 'discovery' },
  { id: 'twilio', displayName: 'Twilio', packageIdentifiers: ['twilio'], apiDomains: ['api.twilio.com'], environmentVariables: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'], documentation: { url: 'https://www.twilio.com/docs' }, capability: 'discovery' },
  { id: 'supabase', displayName: 'Supabase', packageIdentifiers: ['@supabase/supabase-js'], apiDomains: ['*.supabase.co'], environmentVariables: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'], documentation: { url: 'https://supabase.com/docs' }, capability: 'discovery' },
  { id: 'firebase', displayName: 'Firebase', packageIdentifiers: ['firebase', 'firebase-admin'], apiDomains: ['*.firebaseio.com', 'firestore.googleapis.com'], environmentVariables: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'], documentation: { url: 'https://firebase.google.com/docs' }, capability: 'discovery' },
  { id: 'cloudflare', displayName: 'Cloudflare', packageIdentifiers: ['cloudflare', 'wrangler'], apiDomains: ['api.cloudflare.com'], environmentVariables: ['CLOUDFLARE_API_TOKEN'], documentation: { url: 'https://developers.cloudflare.com/' }, capability: 'discovery' },
  { id: 'slack', displayName: 'Slack', packageIdentifiers: ['@slack/web-api', '@slack/bolt'], apiDomains: ['slack.com'], environmentVariables: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'], documentation: { url: 'https://api.slack.com/docs' }, capability: 'discovery' },
];

function normalizePrefix(prefix: string): string {
  return prefix.endsWith('*') ? prefix.slice(0, -1) : prefix;
}

function validatePackageName(value: string, label: string): void {
  if (!value || /\s/.test(value) || value.endsWith('/')) throw new Error(`INVALID_${label}:${value}`);
  if (value.startsWith('@') && !/^@[^/]+\/[^/]+(?:\/[^/]+)*$/.test(value)) throw new Error(`INVALID_${label}:${value}`);
  if (!value.startsWith('@') && !/^[^/]+(?:\/[^/]+)*$/.test(value)) throw new Error(`INVALID_${label}:${value}`);
}

function validatePrefix(value: string): string {
  if (!value || /\s/.test(value) || (value.includes('*') && !value.endsWith('*'))) throw new Error(`INVALID_PROVIDER_PREFIX:${value}`);
  const normalized = normalizePrefix(value);
  if (!normalized || (!normalized.endsWith('/') && !normalized.endsWith('-'))) throw new Error(`INVALID_PROVIDER_PREFIX:${value}`);
  if (normalized.startsWith('@') && !/^@[^/]+\/.+$/.test(normalized)) throw new Error(`INVALID_PROVIDER_PREFIX:${value}`);
  return normalized;
}

function validateDomain(value: string): string {
  const domain = value.startsWith('*.') ? value.slice(2) : value;
  if (!domain || value.includes('://') || value.includes('/') || value !== value.toLowerCase()
    || domain.includes('..') || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error(`INVALID_PROVIDER_DOMAIN:${value}`);
  }
  return domain;
}

export function validateProviderDefinitions(definitions: readonly ProviderDefinition[]): void {
  const ids = new Set<string>();
  const exactPackages = new Map<string, ProviderDefinition[]>();
  const prefixes: string[] = [];
  const environments = new Map<string, ProviderDefinition[]>();
  const domains = new Map<string, ProviderDefinition[]>();
  for (const definition of definitions) {
    if (!/^[a-z][a-z0-9-]*$/.test(definition.id) || ids.has(definition.id)) throw new Error(`INVALID_PROVIDER_ID:${definition.id}`);
    ids.add(definition.id);
    for (const name of definition.packageIdentifiers) {
      validatePackageName(name, 'PROVIDER_PACKAGE');
      const owners = exactPackages.get(name) ?? [];
      if (owners.length && !(definition.allowSharedIdentifiers && owners.every((owner) => owner.allowSharedIdentifiers))) throw new Error(`DUPLICATE_PROVIDER_PACKAGE:${name}`);
      owners.push(definition); exactPackages.set(name, owners);
    }
    for (const prefix of definition.packagePrefixes ?? []) {
      const normalized = validatePrefix(prefix);
      if (prefixes.includes(normalized)) throw new Error(`DUPLICATE_PROVIDER_PREFIX:${prefix}`);
      prefixes.push(normalized);
    }
    for (const domain of definition.apiDomains) {
      const normalized = validateDomain(domain);
      const owners = domains.get(normalized) ?? [];
      if (owners.length && !(definition.allowSharedIdentifiers && owners.every((owner) => owner.allowSharedIdentifiers))) throw new Error(`DUPLICATE_PROVIDER_DOMAIN:${domain}`);
      owners.push(definition); domains.set(normalized, owners);
    }
    for (const variable of definition.environmentVariables) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(variable)) throw new Error(`INVALID_PROVIDER_ENVIRONMENT_VARIABLE:${variable}`);
      const owners = environments.get(variable) ?? [];
      if (owners.length && !(definition.allowSharedIdentifiers && owners.every((owner) => owner.allowSharedIdentifiers))) throw new Error(`DUPLICATE_PROVIDER_ENVIRONMENT_VARIABLE:${variable}`);
      owners.push(definition); environments.set(variable, owners);
    }
  }
  for (const [packageName, owners] of exactPackages) {
    for (const prefix of prefixes) {
      if (packageName.startsWith(prefix) && !(owners.every((owner) => owner.allowSharedIdentifiers))) throw new Error(`AMBIGUOUS_PROVIDER_PACKAGE:${packageName}`);
    }
  }
}

class CharacterPrefixIndex implements PackagePrefixIndex {
  private readonly root: { children: Map<string, CharacterPrefixNode>; providers: ProviderDefinition[] } = { children: new Map(), providers: [] };

  add(prefix: string, provider: ProviderDefinition): void {
    let node = this.root;
    for (const character of prefix) {
      let child = node.children.get(character);
      if (!child) { child = { children: new Map(), providers: [] }; node.children.set(character, child); }
      node = child;
    }
    node.providers.push(provider);
  }

  lookup(packageName: string): ProviderDefinition[] {
    const matches: ProviderDefinition[] = [];
    let node: CharacterPrefixNode | undefined = this.root;
    for (const character of packageName) {
      node = node.children.get(character);
      if (!node) break;
      matches.push(...node.providers);
    }
    return matches;
  }
}

interface CharacterPrefixNode { children: Map<string, CharacterPrefixNode>; providers: ProviderDefinition[] }

class HostDomainIndex implements DomainLookupIndex {
  constructor(private readonly exact: ReadonlyMap<string, readonly ProviderDefinition[]>, private readonly suffix: ReadonlyMap<string, readonly ProviderDefinition[]>) {}

  lookup(hostname: string): ProviderDefinition[] {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    const matches: ProviderDefinition[] = [];
    const seen = new Set<string>();
    const add = (providers: readonly ProviderDefinition[] | undefined): void => {
      for (const provider of providers ?? []) if (!seen.has(provider.id)) { seen.add(provider.id); matches.push(provider); }
    };
    add(this.exact.get(host));
    const labels = host.split('.');
    for (let index = 1; index < labels.length; index += 1) add(this.suffix.get(labels.slice(index).join('.')));
    return matches;
  }
}

function append(map: Map<string, ProviderDefinition[]>, key: string, provider: ProviderDefinition): void {
  const list = map.get(key) ?? [];
  list.push(provider);
  map.set(key, list);
}

export function compileProviderRegistry(definitions: readonly ProviderDefinition[]): ProviderRegistry {
  validateProviderDefinitions(definitions);
  const ordered = [...definitions].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const exactPackages = new Map<string, ProviderDefinition[]>();
  const environments = new Map<string, ProviderDefinition[]>();
  const exactDomains = new Map<string, ProviderDefinition[]>();
  const suffixDomains = new Map<string, ProviderDefinition[]>();
  const packagePrefixes = new CharacterPrefixIndex();
  for (const definition of ordered) {
    for (const packageName of definition.packageIdentifiers) append(exactPackages, packageName, definition);
    for (const prefix of definition.packagePrefixes ?? []) packagePrefixes.add(normalizePrefix(prefix), definition);
    for (const variable of definition.environmentVariables) append(environments, variable, definition);
    for (const domain of definition.apiDomains) {
      const normalized = validateDomain(domain);
      if (domain.startsWith('*.')) append(suffixDomains, normalized, definition);
      else { append(exactDomains, normalized, definition); append(suffixDomains, normalized, definition); }
    }
  }
  return { definitions: ordered, exactPackageIndex: exactPackages, packagePrefixIndex: packagePrefixes,
    environmentVariableIndex: environments, domainIndex: new HostDomainIndex(exactDomains, suffixDomains) };
}

export const DISCOVERY_PROVIDER_REGISTRY = compileProviderRegistry(DISCOVERY_PROVIDERS);
