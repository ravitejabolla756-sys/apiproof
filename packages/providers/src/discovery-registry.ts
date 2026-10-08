/** Discovery metadata is deliberately separate from reviewed compatibility rules. */
export type ProviderCapability = 'discovery' | 'versionAware' | 'compatibility' | 'migration' | 'verifiedMigration';
export type ProviderCategory = 'AI / Models' | 'Cloud / Infrastructure' | 'Backend / Database' | 'Developer Platforms' | 'Communications' | 'Payments / Fintech' | 'Commerce / CRM' | 'Identity' | 'Analytics / Data';

export interface ProviderDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: ProviderCategory;
  readonly packageIdentifiers: readonly string[];
  readonly packagePrefixes?: readonly string[];
  readonly apiDomains: readonly string[];
  /** Header names whose static values may authoritatively identify an API version. */
  readonly apiVersionHeaders?: readonly string[];
  readonly environmentVariables: readonly string[];
  readonly documentation: { readonly url: string; readonly changelogUrl?: string };
  readonly capability: ProviderCapability;
  readonly capabilities: readonly ProviderCapability[];
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

type DiscoveryProviderInput = Omit<ProviderDefinition, 'capability' | 'capabilities'>;
const discoveryProvider = (input: DiscoveryProviderInput): ProviderDefinition => ({
  ...input,
  capability: 'discovery',
  capabilities: input.packageIdentifiers.length || input.packagePrefixes?.length ? ['discovery', 'versionAware'] : ['discovery'],
});

export const DISCOVERY_PROVIDERS: readonly ProviderDefinition[] = [
  discoveryProvider({ id: 'openai', displayName: 'OpenAI', category: 'AI / Models', packageIdentifiers: ['openai'], apiDomains: ['api.openai.com'], environmentVariables: ['OPENAI_API_KEY'], documentation: { url: 'https://platform.openai.com/docs' } }),
  discoveryProvider({ id: 'anthropic', displayName: 'Anthropic', category: 'AI / Models', packageIdentifiers: ['@anthropic-ai/sdk'], apiDomains: ['api.anthropic.com'], environmentVariables: ['ANTHROPIC_API_KEY'], documentation: { url: 'https://docs.anthropic.com/' } }),
  discoveryProvider({ id: 'google-gemini', displayName: 'Google Gemini', category: 'AI / Models', packageIdentifiers: ['@google/genai', '@google/generative-ai'], apiDomains: ['generativelanguage.googleapis.com'], environmentVariables: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], documentation: { url: 'https://ai.google.dev/gemini-api/docs' } }),
  discoveryProvider({ id: 'cohere', displayName: 'Cohere', category: 'AI / Models', packageIdentifiers: ['cohere-ai'], apiDomains: ['api.cohere.com'], environmentVariables: ['COHERE_API_KEY'], documentation: { url: 'https://docs.cohere.com/' } }),
  discoveryProvider({ id: 'deepgram', displayName: 'Deepgram', category: 'AI / Models', packageIdentifiers: ['@deepgram/sdk'], apiDomains: ['api.deepgram.com'], environmentVariables: ['DEEPGRAM_API_KEY'], documentation: { url: 'https://developers.deepgram.com/' } }),
  discoveryProvider({ id: 'mistral', displayName: 'Mistral', category: 'AI / Models', packageIdentifiers: ['@mistralai/mistralai'], apiDomains: ['api.mistral.ai'], environmentVariables: ['MISTRAL_API_KEY'], documentation: { url: 'https://docs.mistral.ai/' } }),
  discoveryProvider({ id: 'groq', displayName: 'Groq', category: 'AI / Models', packageIdentifiers: ['groq-sdk'], apiDomains: ['api.groq.com'], environmentVariables: ['GROQ_API_KEY'], documentation: { url: 'https://console.groq.com/docs' } }),
  discoveryProvider({ id: 'together-ai', displayName: 'Together AI', category: 'AI / Models', packageIdentifiers: ['together-ai'], apiDomains: ['api.together.xyz'], environmentVariables: ['TOGETHER_API_KEY'], documentation: { url: 'https://docs.together.ai/' } }),
  discoveryProvider({ id: 'replicate', displayName: 'Replicate', category: 'AI / Models', packageIdentifiers: ['replicate'], apiDomains: ['api.replicate.com'], environmentVariables: ['REPLICATE_API_TOKEN'], documentation: { url: 'https://replicate.com/docs' } }),
  discoveryProvider({ id: 'hugging-face', displayName: 'Hugging Face', category: 'AI / Models', packageIdentifiers: ['@huggingface/inference'], apiDomains: ['api-inference.huggingface.co'], environmentVariables: ['HF_TOKEN', 'HUGGINGFACEHUB_API_TOKEN'], documentation: { url: 'https://huggingface.co/docs' } }),
  discoveryProvider({ id: 'perplexity', displayName: 'Perplexity', category: 'AI / Models', packageIdentifiers: [], apiDomains: ['api.perplexity.ai'], environmentVariables: ['PERPLEXITY_API_KEY'], documentation: { url: 'https://docs.perplexity.ai/' } }),

  discoveryProvider({ id: 'aws', displayName: 'AWS', category: 'Cloud / Infrastructure', packageIdentifiers: ['aws-sdk'], packagePrefixes: ['@aws-sdk/client-'], apiDomains: [], environmentVariables: ['AWS_ACCESS_KEY_ID', 'AWS_REGION'], documentation: { url: 'https://docs.aws.amazon.com/sdk-for-javascript/' } }),
  discoveryProvider({ id: 'google-cloud', displayName: 'Google Cloud', category: 'Cloud / Infrastructure', packageIdentifiers: ['googleapis'], packagePrefixes: ['@google-cloud/'], apiDomains: [], environmentVariables: ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT'], documentation: { url: 'https://cloud.google.com/docs' } }),
  discoveryProvider({ id: 'microsoft-azure', displayName: 'Microsoft Azure', category: 'Cloud / Infrastructure', packageIdentifiers: ['@azure/identity'], packagePrefixes: ['@azure/'], apiDomains: ['management.azure.com'], environmentVariables: ['AZURE_SUBSCRIPTION_ID', 'AZURE_TENANT_ID'], documentation: { url: 'https://learn.microsoft.com/azure/' } }),
  discoveryProvider({ id: 'cloudflare', displayName: 'Cloudflare', category: 'Cloud / Infrastructure', packageIdentifiers: ['cloudflare', 'wrangler'], apiDomains: ['api.cloudflare.com'], environmentVariables: ['CLOUDFLARE_API_TOKEN'], documentation: { url: 'https://developers.cloudflare.com/' } }),
  discoveryProvider({ id: 'digitalocean', displayName: 'DigitalOcean', category: 'Cloud / Infrastructure', packageIdentifiers: [], apiDomains: ['api.digitalocean.com'], environmentVariables: ['DIGITALOCEAN_ACCESS_TOKEN'], documentation: { url: 'https://docs.digitalocean.com/reference/api/' } }),
  discoveryProvider({ id: 'vercel', displayName: 'Vercel', category: 'Cloud / Infrastructure', packageIdentifiers: ['vercel', '@vercel/sdk'], apiDomains: ['api.vercel.com'], environmentVariables: ['VERCEL_TOKEN'], documentation: { url: 'https://vercel.com/docs/rest-api' } }),
  discoveryProvider({ id: 'netlify', displayName: 'Netlify', category: 'Cloud / Infrastructure', packageIdentifiers: ['@netlify/api'], apiDomains: ['api.netlify.com'], environmentVariables: ['NETLIFY_AUTH_TOKEN'], documentation: { url: 'https://docs.netlify.com/api/get-started/' } }),
  discoveryProvider({ id: 'render', displayName: 'Render', category: 'Cloud / Infrastructure', packageIdentifiers: [], apiDomains: ['api.render.com'], environmentVariables: ['RENDER_API_KEY'], documentation: { url: 'https://api-docs.render.com/' } }),
  discoveryProvider({ id: 'railway', displayName: 'Railway', category: 'Cloud / Infrastructure', packageIdentifiers: [], apiDomains: [], environmentVariables: ['RAILWAY_API_TOKEN'], documentation: { url: 'https://docs.railway.com/' } }),

  discoveryProvider({ id: 'supabase', displayName: 'Supabase', category: 'Backend / Database', packageIdentifiers: ['@supabase/supabase-js'], apiDomains: ['*.supabase.co'], environmentVariables: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'], documentation: { url: 'https://supabase.com/docs' } }),
  discoveryProvider({ id: 'firebase', displayName: 'Firebase', category: 'Backend / Database', packageIdentifiers: ['firebase', 'firebase-admin'], apiDomains: ['*.firebaseio.com', 'firestore.googleapis.com'], environmentVariables: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'], documentation: { url: 'https://firebase.google.com/docs' } }),
  discoveryProvider({ id: 'mongodb', displayName: 'MongoDB', category: 'Backend / Database', packageIdentifiers: ['mongodb'], apiDomains: [], environmentVariables: ['MONGODB_URI'], documentation: { url: 'https://www.mongodb.com/docs/' } }),
  discoveryProvider({ id: 'neon', displayName: 'Neon', category: 'Backend / Database', packageIdentifiers: ['@neondatabase/serverless'], apiDomains: ['api.neon.tech'], environmentVariables: ['NEON_API_KEY'], documentation: { url: 'https://neon.tech/docs' } }),
  discoveryProvider({ id: 'planetscale', displayName: 'PlanetScale', category: 'Backend / Database', packageIdentifiers: ['@planetscale/database'], apiDomains: ['api.planetscale.com'], environmentVariables: ['PLANETSCALE_SERVICE_TOKEN'], documentation: { url: 'https://planetscale.com/docs' } }),
  discoveryProvider({ id: 'upstash', displayName: 'Upstash', category: 'Backend / Database', packageIdentifiers: ['@upstash/redis', '@upstash/qstash'], apiDomains: ['api.upstash.com'], environmentVariables: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], documentation: { url: 'https://upstash.com/docs' } }),
  discoveryProvider({ id: 'redis', displayName: 'Redis', category: 'Backend / Database', packageIdentifiers: ['redis', 'ioredis'], apiDomains: [], environmentVariables: ['REDIS_URL'], documentation: { url: 'https://redis.io/docs/' } }),
  discoveryProvider({ id: 'algolia', displayName: 'Algolia', category: 'Backend / Database', packageIdentifiers: ['algoliasearch'], apiDomains: ['algolia.net'], environmentVariables: ['ALGOLIA_APPLICATION_ID', 'ALGOLIA_ADMIN_API_KEY'], documentation: { url: 'https://www.algolia.com/doc/' } }),

  discoveryProvider({ id: 'github', displayName: 'GitHub', category: 'Developer Platforms', packageIdentifiers: ['@octokit/rest', '@octokit/core', 'octokit'], apiDomains: ['api.github.com'], environmentVariables: ['GITHUB_TOKEN'], documentation: { url: 'https://docs.github.com/en/rest' } }),
  discoveryProvider({ id: 'gitlab', displayName: 'GitLab', category: 'Developer Platforms', packageIdentifiers: ['@gitbeaker/node'], apiDomains: ['gitlab.com'], environmentVariables: ['GITLAB_TOKEN'], documentation: { url: 'https://docs.gitlab.com/api/' } }),
  discoveryProvider({ id: 'bitbucket', displayName: 'Bitbucket', category: 'Developer Platforms', packageIdentifiers: ['bitbucket'], apiDomains: ['api.bitbucket.org'], environmentVariables: ['BITBUCKET_TOKEN'], documentation: { url: 'https://developer.atlassian.com/cloud/bitbucket/rest/' } }),
  discoveryProvider({ id: 'sentry', displayName: 'Sentry', category: 'Developer Platforms', packageIdentifiers: ['@sentry/node', '@sentry/browser', '@sentry/nextjs'], apiDomains: ['sentry.io'], environmentVariables: ['SENTRY_DSN', 'SENTRY_AUTH_TOKEN'], documentation: { url: 'https://docs.sentry.io/' } }),
  discoveryProvider({ id: 'datadog', displayName: 'Datadog', category: 'Developer Platforms', packageIdentifiers: ['dd-trace', '@datadog/datadog-api-client'], apiDomains: ['api.datadoghq.com'], environmentVariables: ['DD_API_KEY', 'DD_APPLICATION_KEY'], documentation: { url: 'https://docs.datadoghq.com/api/' } }),
  discoveryProvider({ id: 'new-relic', displayName: 'New Relic', category: 'Developer Platforms', packageIdentifiers: ['newrelic'], apiDomains: ['api.newrelic.com'], environmentVariables: ['NEW_RELIC_LICENSE_KEY', 'NEW_RELIC_API_KEY'], documentation: { url: 'https://docs.newrelic.com/docs/apis/' } }),
  discoveryProvider({ id: 'elasticsearch', displayName: 'Elasticsearch', category: 'Developer Platforms', packageIdentifiers: ['@elastic/elasticsearch'], apiDomains: ['elastic.co'], environmentVariables: ['ELASTIC_CLOUD_ID', 'ELASTIC_API_KEY'], documentation: { url: 'https://www.elastic.co/docs' } }),

  discoveryProvider({ id: 'twilio', displayName: 'Twilio', category: 'Communications', packageIdentifiers: ['twilio'], apiDomains: ['api.twilio.com'], environmentVariables: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'], documentation: { url: 'https://www.twilio.com/docs' } }),
  discoveryProvider({ id: 'sendgrid', displayName: 'SendGrid', category: 'Communications', packageIdentifiers: ['@sendgrid/mail'], apiDomains: ['api.sendgrid.com'], environmentVariables: ['SENDGRID_API_KEY'], documentation: { url: 'https://docs.sendgrid.com/' } }),
  discoveryProvider({ id: 'mailgun', displayName: 'Mailgun', category: 'Communications', packageIdentifiers: ['mailgun.js'], apiDomains: ['api.mailgun.net'], environmentVariables: ['MAILGUN_API_KEY'], documentation: { url: 'https://documentation.mailgun.com/' } }),
  discoveryProvider({ id: 'postmark', displayName: 'Postmark', category: 'Communications', packageIdentifiers: ['postmark'], apiDomains: ['api.postmarkapp.com'], environmentVariables: ['POSTMARK_SERVER_TOKEN'], documentation: { url: 'https://postmarkapp.com/developer' } }),
  discoveryProvider({ id: 'resend', displayName: 'Resend', category: 'Communications', packageIdentifiers: ['resend'], apiDomains: ['api.resend.com'], environmentVariables: ['RESEND_API_KEY'], documentation: { url: 'https://resend.com/docs' } }),
  discoveryProvider({ id: 'slack', displayName: 'Slack', category: 'Communications', packageIdentifiers: ['@slack/web-api', '@slack/bolt'], apiDomains: ['slack.com'], environmentVariables: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'], documentation: { url: 'https://api.slack.com/docs' } }),
  discoveryProvider({ id: 'atlassian', displayName: 'Atlassian', category: 'Developer Platforms', packageIdentifiers: ['@atlaskit/api'], apiDomains: ['atlassian.net'], environmentVariables: ['ATLASSIAN_API_TOKEN'], documentation: { url: 'https://developer.atlassian.com/' } }),
  discoveryProvider({ id: 'linear', displayName: 'Linear', category: 'Developer Platforms', packageIdentifiers: ['@linear/sdk'], apiDomains: ['linear.app', 'mcp.linear.app'], environmentVariables: ['LINEAR_API_KEY'], documentation: { url: 'https://linear.app/developers' } }),
  discoveryProvider({ id: 'launchdarkly', displayName: 'LaunchDarkly', category: 'Developer Platforms', packageIdentifiers: ['launchdarkly-node-server-sdk'], apiDomains: ['launchdarkly.com', 'app.launchdarkly.com'], apiVersionHeaders: ['LD-API-Version'], environmentVariables: ['LAUNCHDARKLY_SDK_KEY'], documentation: { url: 'https://launchdarkly.com/docs' } }),
  discoveryProvider({ id: 'snowflake', displayName: 'Snowflake', category: 'Analytics / Data', packageIdentifiers: ['snowflake-sdk'], apiDomains: ['snowflakecomputing.com'], environmentVariables: ['SNOWFLAKE_ACCOUNT'], documentation: { url: 'https://docs.snowflake.com/' } }),
  discoveryProvider({ id: 'databricks', displayName: 'Databricks', category: 'Analytics / Data', packageIdentifiers: ['databricks-sql-connector'], apiDomains: ['databricks.com'], environmentVariables: ['DATABRICKS_HOST', 'DATABRICKS_TOKEN'], documentation: { url: 'https://docs.databricks.com/' } }),
  discoveryProvider({ id: 'discord', displayName: 'Discord', category: 'Communications', packageIdentifiers: ['discord.js'], apiDomains: ['discord.com'], environmentVariables: ['DISCORD_TOKEN'], documentation: { url: 'https://discord.com/developers/docs' } }),

  discoveryProvider({ id: 'paypal', displayName: 'PayPal', category: 'Payments / Fintech', packageIdentifiers: ['@paypal/checkout-server-sdk', '@paypal/paypal-server-sdk'], apiDomains: ['api-m.paypal.com'], environmentVariables: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'], documentation: { url: 'https://developer.paypal.com/api/rest/' } }),
  discoveryProvider({ id: 'adyen', displayName: 'Adyen', category: 'Payments / Fintech', packageIdentifiers: ['@adyen/api-library'], apiDomains: ['checkout-live.adyen.com', 'checkout-test.adyen.com'], environmentVariables: ['ADYEN_API_KEY', 'ADYEN_MERCHANT_ACCOUNT'], documentation: { url: 'https://docs.adyen.com/api-explorer/' } }),
  discoveryProvider({ id: 'square', displayName: 'Square', category: 'Payments / Fintech', packageIdentifiers: ['square'], apiDomains: ['connect.squareup.com'], environmentVariables: ['SQUARE_ACCESS_TOKEN'], documentation: { url: 'https://developer.squareup.com/docs' } }),
  discoveryProvider({ id: 'plaid', displayName: 'Plaid', category: 'Payments / Fintech', packageIdentifiers: ['plaid'], apiDomains: ['production.plaid.com'], environmentVariables: ['PLAID_CLIENT_ID', 'PLAID_SECRET'], documentation: { url: 'https://plaid.com/docs/' } }),
  discoveryProvider({ id: 'razorpay', displayName: 'Razorpay', category: 'Payments / Fintech', packageIdentifiers: ['razorpay'], apiDomains: ['api.razorpay.com'], environmentVariables: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'], documentation: { url: 'https://razorpay.com/docs/api/' } }),
  discoveryProvider({ id: 'paddle', displayName: 'Paddle', category: 'Payments / Fintech', packageIdentifiers: ['@paddle/paddle-node-sdk'], apiDomains: ['api.paddle.com'], environmentVariables: ['PADDLE_API_KEY'], documentation: { url: 'https://developer.paddle.com/' } }),
  discoveryProvider({ id: 'chargebee', displayName: 'Chargebee', category: 'Payments / Fintech', packageIdentifiers: ['chargebee'], apiDomains: ['api.chargebee.com'], environmentVariables: ['CHARGEBEE_API_KEY'], documentation: { url: 'https://www.chargebee.com/docs/' } }),
  discoveryProvider({ id: 'braintree', displayName: 'Braintree', category: 'Payments / Fintech', packageIdentifiers: ['braintree'], apiDomains: ['api.braintreegateway.com'], environmentVariables: ['BRAINTREE_MERCHANT_ID', 'BRAINTREE_PUBLIC_KEY', 'BRAINTREE_PRIVATE_KEY'], documentation: { url: 'https://developer.paypal.com/braintree/docs/' } }),

  discoveryProvider({ id: 'shopify', displayName: 'Shopify', category: 'Commerce / CRM', packageIdentifiers: ['@shopify/shopify-api', 'shopify-api-node'], apiDomains: ['admin.shopify.com'], environmentVariables: ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'], documentation: { url: 'https://shopify.dev/docs/api' } }),
  discoveryProvider({ id: 'hubspot', displayName: 'HubSpot', category: 'Commerce / CRM', packageIdentifiers: ['@hubspot/api-client'], apiDomains: ['api.hubapi.com'], environmentVariables: ['HUBSPOT_ACCESS_TOKEN'], documentation: { url: 'https://developers.hubspot.com/docs/api/overview' } }),
  discoveryProvider({ id: 'salesforce', displayName: 'Salesforce', category: 'Commerce / CRM', packageIdentifiers: ['jsforce'], apiDomains: ['login.salesforce.com'], environmentVariables: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'], documentation: { url: 'https://developer.salesforce.com/docs/apis' } }),
  discoveryProvider({ id: 'woocommerce', displayName: 'WooCommerce', category: 'Commerce / CRM', packageIdentifiers: ['@woocommerce/woocommerce-rest-api'], apiDomains: [], environmentVariables: ['WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'], documentation: { url: 'https://woocommerce.github.io/woocommerce-rest-api-docs/' } }),

  discoveryProvider({ id: 'auth0', displayName: 'Auth0', category: 'Identity', packageIdentifiers: ['auth0'], apiDomains: ['auth0.com'], environmentVariables: ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'], documentation: { url: 'https://auth0.com/docs' } }),
  discoveryProvider({ id: 'clerk', displayName: 'Clerk', category: 'Identity', packageIdentifiers: ['@clerk/backend', '@clerk/nextjs'], apiDomains: ['clerk.com'], environmentVariables: ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'], documentation: { url: 'https://clerk.com/docs' } }),
  discoveryProvider({ id: 'okta', displayName: 'Okta', category: 'Identity', packageIdentifiers: ['@okta/okta-sdk-nodejs', '@okta/oidc-middleware'], apiDomains: ['okta.com'], environmentVariables: ['OKTA_DOMAIN', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET'], documentation: { url: 'https://developer.okta.com/docs/' } }),
  discoveryProvider({ id: 'workos', displayName: 'WorkOS', category: 'Identity', packageIdentifiers: ['@workos-inc/node'], apiDomains: ['api.workos.com'], environmentVariables: ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID'], documentation: { url: 'https://workos.com/docs' } }),

  discoveryProvider({ id: 'segment', displayName: 'Segment', category: 'Analytics / Data', packageIdentifiers: ['@segment/analytics-node', '@segment/analytics-next'], apiDomains: ['api.segment.io'], environmentVariables: ['SEGMENT_WRITE_KEY'], documentation: { url: 'https://segment.com/docs/' } }),
  discoveryProvider({ id: 'elevenlabs', displayName: 'ElevenLabs', category: 'AI / Models', packageIdentifiers: ['@elevenlabs/elevenlabs-js'], apiDomains: ['api.elevenlabs.io'], environmentVariables: ['ELEVENLABS_API_KEY'], documentation: { url: 'https://elevenlabs.io/docs' } }),
  discoveryProvider({ id: 'mixpanel', displayName: 'Mixpanel', category: 'Analytics / Data', packageIdentifiers: ['mixpanel'], apiDomains: ['api.mixpanel.com'], environmentVariables: ['MIXPANEL_TOKEN', 'MIXPANEL_PROJECT_TOKEN'], documentation: { url: 'https://docs.mixpanel.com/' } }),
  discoveryProvider({ id: 'amplitude', displayName: 'Amplitude', category: 'Analytics / Data', packageIdentifiers: ['@amplitude/analytics-node', '@amplitude/analytics-browser'], apiDomains: ['api2.amplitude.com'], environmentVariables: ['AMPLITUDE_API_KEY'], documentation: { url: 'https://www.docs.developers.amplitude.com/' } }),
];

export interface ProviderCatalogSummary {
  providerId: string;
  providerName: string;
  category: ProviderCategory;
  capabilities: readonly ProviderCapability[];
  packageCount: number;
  prefixCount: number;
  domainCount: number;
  environmentVariableCount: number;
}

export const PROVIDER_CATALOG_SUMMARY: readonly ProviderCatalogSummary[] = DISCOVERY_PROVIDERS.map((provider) => ({
  providerId: provider.id,
  providerName: provider.displayName,
  category: provider.category,
  capabilities: provider.capabilities,
  packageCount: provider.packageIdentifiers.length,
  prefixCount: provider.packagePrefixes?.length ?? 0,
  domainCount: provider.apiDomains.length,
  environmentVariableCount: provider.environmentVariables.length,
}));

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
  if (normalized.startsWith('@') && !/^@[^/]+\/(?:.*)?$/.test(normalized)) throw new Error(`INVALID_PROVIDER_PREFIX:${value}`);
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
  const prefixes: Array<{ value: string; owner: ProviderDefinition }> = [];
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
      if (prefixes.some((entry) => entry.value === normalized)) throw new Error(`DUPLICATE_PROVIDER_PREFIX:${prefix}`);
      prefixes.push({ value: normalized, owner: definition });
    }
    for (const domain of definition.apiDomains) {
      const normalized = validateDomain(domain);
      const owners = domains.get(normalized) ?? [];
      if (owners.length && !(definition.allowSharedIdentifiers && owners.every((owner) => owner.allowSharedIdentifiers))) throw new Error(`DUPLICATE_PROVIDER_DOMAIN:${domain}`);
      owners.push(definition); domains.set(normalized, owners);
    }
    for (const header of definition.apiVersionHeaders ?? []) {
      if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(header)) throw new Error(`INVALID_PROVIDER_API_VERSION_HEADER:${header}`);
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
      if (packageName.startsWith(prefix.value)
        && !owners.every((owner) => owner.id === prefix.owner.id || (owner.allowSharedIdentifiers && prefix.owner.allowSharedIdentifiers))) {
        throw new Error(`AMBIGUOUS_PROVIDER_PACKAGE:${packageName}`);
      }
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
