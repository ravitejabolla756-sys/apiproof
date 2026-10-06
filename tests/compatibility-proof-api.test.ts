import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET } from '../apps/web/src/app/api/compatibility-proof/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';

const DB_PATH = path.resolve('.tmp/compatibility-proof-api.db');

describe('GET /api/compatibility-proof', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'compatibility-proof-test-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('exposes the seven reviewed local records with their scopes and provenance', async () => {
    const { session } = await createUserWithSession('compatibility-proof-api@example.com', 'Strong-password-1!', 'Proof API User');
    const response = await GET(new Request('http://localhost/api/compatibility-proof', { headers: { cookie: `apiproof_session=${session.id}` } }));
    expect(response.status).toBe(200);
    const body = await response.json() as { claimsAvailable: boolean; changes: Array<Record<string, unknown>> };
    expect(body.claimsAvailable).toBe(true);
    expect(body.changes.map((change) => change.changeId)).toEqual([
      'anthropic-claude-opus-4-1-retirement-2026-08-05',
      'anthropic-opus-4-7-parameter-restrictions',
      'github-organization-security-fields-removed-2026-04-21',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
      'supabase-management-logs-all-removal-2026-09-23',
      'supabase-openapi-anon-key-access-2026-03-11',
      'twilio-regional-api-domain-removal-2026-04-28',
    ]);
    expect(body.changes.filter((change) => change.providerId === 'openai')).toHaveLength(2);
    expect(body.changes.filter((change) => change.providerId === 'anthropic')).toHaveLength(2);
    expect(body.changes.filter((change) => change.providerId === 'github')).toHaveLength(2);
    expect(body.changes.filter((change) => change.providerId === 'twilio')).toHaveLength(1);
    expect(body.changes.filter((change) => change.providerId === 'supabase')).toHaveLength(2);
    expect(body.changes.find((change) => change.changeId === 'supabase-management-logs-all-removal-2026-09-23')).toMatchObject({
      providerId: 'supabase',
      changeType: 'endpoint_removed',
      applicabilityScope: { dimensions: ['provider', 'endpoint'] },
      affectedEndpoints: ['analytics/endpoints/logs.all'],
      replacement: { endpoint: 'analytics/endpoints/logs' },
      removalAt: '2026-09-23',
      severity: 'high',
    });
    expect(body.changes.find((change) => change.changeId === 'supabase-openapi-anon-key-access-2026-03-11')).toMatchObject({
      providerId: 'supabase',
      changeType: 'parameter_required',
      applicabilityScope: { dimensions: ['provider', 'endpoint', 'auth_or_header'] },
      affectedEndpoints: ['/rest/v1/'],
      authOrHeaderPatterns: ['anon key'],
      effectiveAt: '2026-03-11',
      severity: 'high',
    });
    expect(body.changes.find((change) => change.changeId === 'anthropic-claude-opus-4-1-retirement-2026-08-05')).toMatchObject({
      providerId: 'anthropic',
      changeType: 'model_retired',
      applicabilityScope: { dimensions: ['provider', 'model'] },
      affectedModels: ['claude-opus-4-1-20250805'],
      affectedResources: [],
      replacement: { model: 'claude-opus-4-8' },
      removalAt: '2026-08-05',
      severity: 'high',
      officialSourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations',
      reviewStatus: 'reviewed',
      provenance: 'official',
      reviewer: 'Ravi Teja',
      reviewedAt: '2026-10-05',
    });
    expect(body.changes.find((change) => change.changeId === 'openai-assistants-api-sunset-2026-08-26')).toMatchObject({
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      affectedResources: ['Assistants API'],
      affectedModels: [],
      replacement: { resources: ['Responses API', 'Conversations API'] },
      reviewStatus: 'reviewed',
      provenance: 'official',
      reviewer: 'Ravi Teja',
      reviewedAt: '2026-10-05',
      removalAt: '2026-08-26',
    });
    expect(body.changes.find((change) => change.changeId === 'openai-gpt-4-5-preview-removal-2025-07-14')).toMatchObject({
      applicabilityScope: { dimensions: ['provider', 'model'] },
      affectedModels: ['gpt-4.5-preview'],
      affectedResources: [],
      replacement: { model: 'gpt-4.1' },
    });
    expect(body.changes.find((change) => change.changeId === 'github-organization-security-fields-removed-2026-04-21')).toMatchObject({
      providerId: 'github', changeType: 'response_field_removed',
      applicabilityScope: { dimensions: ['provider', 'resource', 'response_field'] },
      affectedResources: ['get an organization and update an organization REST API endpoints'],
      affectedResponseFields: [
        'advanced_security_enabled_for_new_repositories', 'dependabot_alerts_enabled_for_new_repositories',
        'dependabot_security_updates_enabled_for_new_repositories', 'dependency_graph_enabled_for_new_repositories',
        'secret_scanning_enabled_for_new_repositories', 'secret_scanning_push_protection_enabled_for_new_repositories',
        'secret_scanning_validity_checks_enabled',
      ],
      removalAt: '2026-04-21', severity: 'medium', replacement: { resources: ['GitHub Code Security configurations'] },
      officialSourceUrl: 'https://github.blog/changelog/2026-03-24-upcoming-deprecation-of-security-related-organization-api-fields/',
      reviewer: 'Ravi Teja', reviewedAt: '2026-10-06', reviewStatus: 'reviewed', provenance: 'official',
      documentFingerprint: '53a3e3e386510ad229d78b9ccca3eac343c43596d5e9dd14e79b5a74dc0e9d5a',
      evidenceFingerprint: '58adfc89004241550723c3891f29953e65d03dd752d974932fbc61d54e05c78f',
      candidateFingerprint: '59bb233364fafa44ab4bff7177300bc507a7478ae84f0d7cf001d9522eb9a708',
    });
    expect(body.changes.find((change) => change.changeId === 'github-synchronous-sbom-endpoint-removal-2026-11-13')).toMatchObject({
      providerId: 'github', changeType: 'endpoint_removed',
      applicabilityScope: { dimensions: ['provider', 'endpoint'] },
      affectedEndpoints: ['/{owner}/{repo}/dependency-graph/sbom'],
      replacement: { endpoint: '/{owner}/{repo}/dependency-graph/sbom/generate-report' },
      publishedAt: '2026-05-12', removalAt: '2026-11-13', severity: 'high',
      officialSourceUrl: 'https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/',
      reviewer: 'Ravi Teja', reviewedAt: '2026-10-06', reviewStatus: 'reviewed', provenance: 'official',
      documentFingerprint: 'f509f8d68a1bd919c655c0d367a998f233829c53a5c4e7431cd9b45bea1d16f0',
      evidenceFingerprint: '4fa080a36ae032f8b589028bbc74233d8aa43a6a1625bc2037d85f9b1cd5f81f',
      candidateFingerprint: 'd88ec47a8f030ce6f4e318c70ddc6880ee310ac8c6c107ee8e5af06c94680bec',
    });
    expect(body.changes.find((change) => change.changeId === 'twilio-regional-api-domain-removal-2026-04-28')).toMatchObject({
      providerId: 'twilio', changeType: 'endpoint_removed',
      applicabilityScope: { dimensions: ['provider', 'domain'] },
      affectedDomains: ['api.ie1.twilio.com', 'api.au1.twilio.com', 'api.br1.twilio.com', 'api.de1.twilio.com', 'api.jp1.twilio.com', 'api.sg1.twilio.com', 'api.us2.twilio.com'],
      replacement: { domain: 'api.twilio.com' },
      publishedAt: '2026-02-04', removalAt: '2026-04-28', severity: 'high',
      reviewer: 'Ravi Teja', reviewedAt: '2026-10-06', reviewStatus: 'reviewed', provenance: 'official',
      documentFingerprint: 'c21edcc6438491332e641f4f6706ce98830d191009c326555af7bc728d7719ed',
      evidenceFingerprint: 'd6219d4929018c959dbd916b38773325cc8ce3a709f7ddb8d68dc5a3e838e3d6',
      candidateFingerprint: '6646a65d4ac5bd2ed3f549013766ed95beedd5bfc4c7b5c78ab0c4a117bb0143',
    });
  });
});
