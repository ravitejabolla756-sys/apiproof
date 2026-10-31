import {
  buildProviderReviewPack,
  LOCAL_REVIEWED_PRODUCTION_RECORDS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  renderProviderReviewPackMarkdown,
} from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '../src/lib/server/provider-change-monitor.js';

const pack = buildProviderReviewPack({
  candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
  monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
  reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
  templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
  expectedProviderCount: 19,
});

console.log(process.argv.includes('--json') ? JSON.stringify(pack, null, 2) : renderProviderReviewPackMarkdown(pack));
