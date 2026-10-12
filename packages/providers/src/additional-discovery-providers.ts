import type { ProviderCategory, ProviderDefinition } from './discovery-registry.js';

/**
 * Domain-only discovery metadata for high-usage providers not yet backed by a
 * reviewed compatibility rule. These entries enable deterministic provider
 * identification without implying version, deprecation, or compatibility
 * coverage. A provider must still receive an evidence-backed candidate and
 * human review before it can affect the production compatibility registry.
 */
const discoveryOnly = (input: {
  id: string;
  displayName: string;
  category: ProviderCategory;
  apiDomain: string;
  documentationUrl: string;
}): ProviderDefinition => ({
  id: input.id,
  displayName: input.displayName,
  category: input.category,
  packageIdentifiers: [],
  apiDomains: [input.apiDomain],
  environmentVariables: [],
  documentation: { url: input.documentationUrl },
  capability: 'discovery',
  capabilities: ['discovery'],
});

/** Official documentation-backed provider identities; compatibility remains unreviewed. */
export const ADDITIONAL_DISCOVERY_PROVIDERS: readonly ProviderDefinition[] = [
  discoveryOnly({ id: 'stripe', displayName: 'Stripe', category: 'Payments / Fintech', apiDomain: 'api.stripe.com', documentationUrl: 'https://docs.stripe.com/' }),
  discoveryOnly({ id: 'airtable', displayName: 'Airtable', category: 'Commerce / CRM', apiDomain: 'api.airtable.com', documentationUrl: 'https://airtable.com/developers/web/api/introduction' }),
  discoveryOnly({ id: 'notion', displayName: 'Notion', category: 'Commerce / CRM', apiDomain: 'api.notion.com', documentationUrl: 'https://developers.notion.com/' }),
  discoveryOnly({ id: 'asana', displayName: 'Asana', category: 'Commerce / CRM', apiDomain: 'app.asana.com', documentationUrl: 'https://developers.asana.com/' }),
  discoveryOnly({ id: 'trello', displayName: 'Trello', category: 'Commerce / CRM', apiDomain: 'api.trello.com', documentationUrl: 'https://developer.atlassian.com/cloud/trello/' }),
  discoveryOnly({ id: 'monday', displayName: 'monday.com', category: 'Commerce / CRM', apiDomain: 'api.monday.com', documentationUrl: 'https://developer.monday.com/api-reference/docs' }),
  discoveryOnly({ id: 'pipedrive', displayName: 'Pipedrive', category: 'Commerce / CRM', apiDomain: 'api.pipedrive.com', documentationUrl: 'https://developers.pipedrive.com/docs/api/v1' }),
  discoveryOnly({ id: 'close', displayName: 'Close', category: 'Commerce / CRM', apiDomain: 'api.close.com', documentationUrl: 'https://developer.close.com/' }),
  discoveryOnly({ id: 'gong', displayName: 'Gong', category: 'Commerce / CRM', apiDomain: 'api.gong.io', documentationUrl: 'https://help.gong.io/docs/gong-api' }),
  discoveryOnly({ id: 'intercom', displayName: 'Intercom', category: 'Commerce / CRM', apiDomain: 'api.intercom.io', documentationUrl: 'https://developers.intercom.com/' }),
  discoveryOnly({ id: 'zendesk', displayName: 'Zendesk', category: 'Commerce / CRM', apiDomain: 'api.zendesk.com', documentationUrl: 'https://developer.zendesk.com/api-reference/' }),
  discoveryOnly({ id: 'freshdesk', displayName: 'Freshdesk', category: 'Commerce / CRM', apiDomain: 'freshdesk.com', documentationUrl: 'https://developers.freshdesk.com/api/' }),
  discoveryOnly({ id: 'cockroachdb', displayName: 'CockroachDB', category: 'Backend / Database', apiDomain: 'cockroachlabs.cloud', documentationUrl: 'https://www.cockroachlabs.com/docs/' }),
  discoveryOnly({ id: 'turso', displayName: 'Turso', category: 'Backend / Database', apiDomain: 'api.turso.tech', documentationUrl: 'https://docs.turso.tech/' }),
  discoveryOnly({ id: 'prisma', displayName: 'Prisma', category: 'Backend / Database', apiDomain: 'api.prisma.io', documentationUrl: 'https://www.prisma.io/docs' }),
  discoveryOnly({ id: 'hasura', displayName: 'Hasura', category: 'Backend / Database', apiDomain: 'hasura.io', documentationUrl: 'https://hasura.io/docs/' }),
  discoveryOnly({ id: 'convex', displayName: 'Convex', category: 'Backend / Database', apiDomain: 'api.convex.dev', documentationUrl: 'https://docs.convex.dev/' }),
  discoveryOnly({ id: 'appwrite', displayName: 'Appwrite', category: 'Backend / Database', apiDomain: 'cloud.appwrite.io', documentationUrl: 'https://appwrite.io/docs' }),
  discoveryOnly({ id: 'fauna', displayName: 'Fauna', category: 'Backend / Database', apiDomain: 'db.fauna.com', documentationUrl: 'https://docs.fauna.com/' }),
  discoveryOnly({ id: 'fastly', displayName: 'Fastly', category: 'Cloud / Infrastructure', apiDomain: 'api.fastly.com', documentationUrl: 'https://www.fastly.com/documentation/reference/api/' }),
  discoveryOnly({ id: 'cloudinary', displayName: 'Cloudinary', category: 'Cloud / Infrastructure', apiDomain: 'api.cloudinary.com', documentationUrl: 'https://cloudinary.com/documentation' }),
  discoveryOnly({ id: 'flyio', displayName: 'Fly.io', category: 'Cloud / Infrastructure', apiDomain: 'api.machines.dev', documentationUrl: 'https://fly.io/docs/' }),
  discoveryOnly({ id: 'heroku', displayName: 'Heroku', category: 'Cloud / Infrastructure', apiDomain: 'api.heroku.com', documentationUrl: 'https://devcenter.heroku.com/categories/reference' }),
  discoveryOnly({ id: 'bitrise', displayName: 'Bitrise', category: 'Developer Platforms', apiDomain: 'api.bitrise.io', documentationUrl: 'https://docs.bitrise.io/' }),
  discoveryOnly({ id: 'circleci', displayName: 'CircleCI', category: 'Developer Platforms', apiDomain: 'circleci.com', documentationUrl: 'https://circleci.com/docs/' }),
  discoveryOnly({ id: 'buildkite', displayName: 'Buildkite', category: 'Developer Platforms', apiDomain: 'api.buildkite.com', documentationUrl: 'https://buildkite.com/docs/apis' }),
  discoveryOnly({ id: 'docker', displayName: 'Docker', category: 'Developer Platforms', apiDomain: 'hub.docker.com', documentationUrl: 'https://docs.docker.com/' }),
  discoveryOnly({ id: 'posthog', displayName: 'PostHog', category: 'Analytics / Data', apiDomain: 'us.posthog.com', documentationUrl: 'https://posthog.com/docs' }),
  discoveryOnly({ id: 'mux', displayName: 'Mux', category: 'Cloud / Infrastructure', apiDomain: 'api.mux.com', documentationUrl: 'https://www.mux.com/docs' }),
  discoveryOnly({ id: 'mapbox', displayName: 'Mapbox', category: 'Cloud / Infrastructure', apiDomain: 'api.mapbox.com', documentationUrl: 'https://docs.mapbox.com/api/' }),
] as const;
