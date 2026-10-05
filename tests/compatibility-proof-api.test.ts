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

  it('exposes both reviewed OpenAI records with their distinct scopes and provenance', async () => {
    const { session } = await createUserWithSession('compatibility-proof-api@example.com', 'Strong-password-1!', 'Proof API User');
    const response = await GET(new Request('http://localhost/api/compatibility-proof', { headers: { cookie: `apiproof_session=${session.id}` } }));
    expect(response.status).toBe(200);
    const body = await response.json() as { claimsAvailable: boolean; changes: Array<Record<string, unknown>> };
    expect(body.claimsAvailable).toBe(true);
    expect(body.changes.map((change) => change.changeId)).toEqual([
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
    ]);
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
  });
});
