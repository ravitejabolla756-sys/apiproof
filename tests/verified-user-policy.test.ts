import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { assertVerifiedUser, evaluateVerifiedUserPolicy, loadVerifiedUserPolicy } from '../apps/web/src/lib/server/verified-user-policy.js';

const DB_PATH = path.resolve('.tmp/test-verified-user-policy.db');

describe('verified-user policy boundary', () => {
  it('keeps onboarding and recovery available before verification', () => {
    for (const action of ['onboarding', 'recovery'] as const) {
      expect(evaluateVerifiedUserPolicy({ action, verificationStateAvailable: false })).toBe('allow');
    }
  });

  it('fails closed for protected actions when the verification state is unavailable', () => {
    for (const action of ['authenticated_account', 'workspace', 'provider_link'] as const) {
      expect(evaluateVerifiedUserPolicy({ action, verificationStateAvailable: false })).toBe('verification_unavailable');
      expect(() => assertVerifiedUser({ action, verificationStateAvailable: false })).toThrow('VERIFICATION_STATE_UNAVAILABLE');
    }
  });

  it('requires verification for protected actions until the server state is verified', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'provider_link', verificationStateAvailable: true })).toBe('require_verification');
    expect(evaluateVerifiedUserPolicy({ action: 'provider_link', verificationStateAvailable: true, emailVerifiedAt: null })).toBe('require_verification');
    expect(() => assertVerifiedUser({ action: 'provider_link', verificationStateAvailable: true, emailVerifiedAt: null })).toThrow('EMAIL_VERIFICATION_REQUIRED');
  });

  it('accepts only server-derived verified state or an approved provider verification', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, emailVerifiedAt: '2026-11-12T10:00:00.000Z' })).toBe('allow');
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, providerVerified: true })).toBe('allow');
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, emailVerifiedAt: 'not-a-date', providerVerified: false })).toBe('require_verification');
  });

  it('does not let an unapproved client-like value grant access', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, providerVerified: false, emailVerifiedAt: 'true' })).toBe('require_verification');
  });

  it('does not let provider verification bypass an unavailable server state', () => {
    expect(evaluateVerifiedUserPolicy({ action: 'provider_link', verificationStateAvailable: false, providerVerified: true })).toBe('verification_unavailable');
  });

  it('rejects a future verification timestamp instead of trusting clock-skewed state', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(evaluateVerifiedUserPolicy({ action: 'workspace', verificationStateAvailable: true, emailVerifiedAt: future })).toBe('require_verification');
  });
});

describe('server-backed verified-user policy', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    delete process.env.APIPROOF_DB_PATH;
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('fails closed when the reconciled verification column is absent', async () => {
    const { user } = await createUserWithSession('unavailable@example.test', 'Pass12345!', 'Unavailable');
    await expect(loadVerifiedUserPolicy(user.id, 'provider_link')).resolves.toMatchObject({
      action: 'provider_link',
      verificationStateAvailable: false,
    });
  });

  it('reads only the server-stored verification timestamp', async () => {
    const { user } = await createUserWithSession('verified@example.test', 'Pass12345!', 'Verified');
    const db = getDatabase();
    await db.execute('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
    await db.execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);
    const policy = await loadVerifiedUserPolicy(user.id, 'provider_link');
    expect(policy).toMatchObject({
      action: 'provider_link',
      verificationStateAvailable: true,
      providerVerified: false,
    });
    expect(evaluateVerifiedUserPolicy(policy)).toBe('allow');
  });
});
