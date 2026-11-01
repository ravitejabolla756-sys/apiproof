import {
  buildProviderReviewCoverageReport,
  LOCAL_REVIEWED_PRODUCTION_RECORDS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
} from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '../src/lib/server/provider-change-monitor.js';

const report = buildProviderReviewCoverageReport({
  candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
  monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
  reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
  templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
  expectedProviderCount: 19,
});

console.log(JSON.stringify(report, null, 2));
