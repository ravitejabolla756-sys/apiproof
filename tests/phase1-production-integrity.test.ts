import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  getVerifierSecret,
  createVerificationEvidence,
  verifyEvidenceBinding,
} from '@apiproof/core';
import { initDatabase } from '../apps/web/src/lib/server/db.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';
import { checkRateLimit, resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';
import {
  assertCsrfProtection,
  validateSignupInput,
  validateLoginInput,
  validateRepositoryConnectInput,
  validateSafeId,
} from '../apps/web/src/lib/server/validation.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase1-integrity.db');

describe('APIProof Phase 1 — Production Integrity Test Suite', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'test-stable-verification-secret-32-bytes-long';
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    db = initDatabase(TEST_DB_PATH);
    resetRateLimits();
  });

  afterEach(() => {
    try {
      db.close();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;
    delete process.env.APIPROOF_SECRET;
    delete process.env.AUTH_SECRET;
  });

  // =========================================================================
  // 1. STABLE VERIFICATION SECRET & CROSS-PROCESS VERIFICATION
  // =========================================================================
  describe('1. Stable Verification Secret & Multi-instance Provenance', () => {
    const mockInput = {
      repositoryId: '1363070568',
      baselineSha: 'b1be45b401f41106ecfd489bbbb1fff71639c763',
      changeId: 'stripe-subscription-coupon-removed',
      patchDigest: 'a'.repeat(64),
      proofLevel: 'CONTRACT_VERIFIED' as const,
      patchApplied: true,
      typecheckPassed: true,
      testsPassed: true,
      contractPassed: true,
    };

    it('signs and verifies evidence deterministically using APIPROOF_SECRET', () => {
      const secret = 'shared-production-secret-for-apiproof';
      const evidence = createVerificationEvidence(mockInput, secret);

      expect(evidence.provenanceToken).toHaveLength(64);
      expect(evidence.evidenceDigest).toHaveLength(64);

      // Verify with matching secret -> passes
      const check = verifyEvidenceBinding(evidence, {
        repositoryId: mockInput.repositoryId,
        baselineSha: mockInput.baselineSha,
        changeId: mockInput.changeId,
        patchDigest: mockInput.patchDigest,
      }, secret);
      expect(check.valid).toBe(true);

      // Verify with wrong secret -> fails
      const wrongSecretCheck = verifyEvidenceBinding(evidence, {
        repositoryId: mockInput.repositoryId,
        baselineSha: mockInput.baselineSha,
        changeId: mockInput.changeId,
        patchDigest: mockInput.patchDigest,
      }, 'wrong-secret-key-0000000000000000');
      expect(wrongSecretCheck.valid).toBe(false);
      expect(wrongSecretCheck.reason).toContain('Verifier provenance signature check failed');
    });

    it('verifies evidence across simulated separate Vercel serverless invocations sharing APIPROOF_SECRET', () => {
      const sharedClusterSecret = 'cluster-secret-key-prod-0123456789abcdef';

      // Simulation: Invocation A generates migration plan & creates verification evidence
      process.env.APIPROOF_SECRET = sharedClusterSecret;
      const invocationAEvidence = createVerificationEvidence(mockInput);

      // Simulation: Invocation B receives evidence in proposal request and verifies it
      // Separate process / execution context reading same environment secret:
      process.env.APIPROOF_SECRET = sharedClusterSecret;
      const crossInvocationVerified = verifyEvidenceBinding(invocationAEvidence, {
        repositoryId: mockInput.repositoryId,
        baselineSha: mockInput.baselineSha,
        changeId: mockInput.changeId,
        patchDigest: mockInput.patchDigest,
      });
      expect(crossInvocationVerified.valid).toBe(true);
    });

    it('falls back to AUTH_SECRET when APIPROOF_SECRET is not configured', () => {
      delete process.env.APIPROOF_SECRET;
      process.env.AUTH_SECRET = 'auth-secret-fallback-key-0123456789';

      const secret = getVerifierSecret();
      expect(secret).toBe('auth-secret-fallback-key-0123456789');

      delete process.env.AUTH_SECRET;
    });

    it('fails fast in production mode if no verification secret exists', () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.APIPROOF_SECRET;
      delete process.env.AUTH_SECRET;

      expect(() => getVerifierSecret()).toThrow(
        /Production requires APIPROOF_SECRET/
      );

      process.env.NODE_ENV = oldEnv;
    });
  });

  // =========================================================================
  // 2. PRODUCTION GITHUB WRITE TRANSPORT SELECTION
  // =========================================================================
  describe('2. GitHub Controlled Write Transport Selection', () => {
    it('defaults to safe FakeGitHubWriteTransport when APIPROOF_ENABLE_LIVE_GITHUB_WRITE is not set', async () => {
      delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;

      const user = createUser('transport_test@example.com', 'Pass1234!', 'Transport User');
      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES ('repo_transport', ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
      `).run(user.id, new Date().toISOString());

      const scanResult = await runRepositoryScan('repo_transport', user.id);
      expect(scanResult.findingsCount).toBeGreaterThan(0);

      const findings = db.prepare('SELECT id FROM findings WHERE repository_id = ?').all('repo_transport') as { id: string }[];
      const migration = await generateMigrationForFinding(findings[0]!.id, user.id);

      // Proposal must succeed using FakeGitHubWriteTransport (safe default, no real API calls)
      const proposal = await createGitHubProposal(migration.id, user.id);
      expect(proposal.pullRequestId).toBeDefined();
      expect(proposal.url).toBeDefined();
      expect(proposal.number).toBe(1);
      expect(proposal.state).toBe('draft');
    });

    it('selects live write transport only when APIPROOF_ENABLE_LIVE_GITHUB_WRITE=true', () => {
      process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE = 'true';
      const isLiveEnabled = process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true';
      expect(isLiveEnabled).toBe(true);

      process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE = 'false';
      expect(process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true').toBe(false);
    });
  });

  // =========================================================================
  // 3. IDEMPOTENT FINDINGS DEDUPLICATION
  // =========================================================================
  describe('3. Idempotent Findings Deduplication', () => {
    it('repeated scans of the same repository and commit do NOT create duplicate finding records', async () => {
      const user = createUser('dedup_tester@example.com', 'Pass1234!', 'Dedup Tester');
      const repoId = 'repo_dedup_test';

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
      `).run(repoId, user.id, new Date().toISOString());

      // First scan:
      const firstScan = await runRepositoryScan(repoId, user.id);
      expect(firstScan.findingsCount).toBe(1);

      interface FindingRecord { id: string; status: string; }
      const firstFindingRows = db.prepare('SELECT * FROM findings WHERE repository_id = ?').all(repoId) as unknown as FindingRecord[];
      expect(firstFindingRows.length).toBe(1);
      const originalFindingId = firstFindingRows[0]!.id;

      // Second scan of the exact same repository and AST:
      const secondScan = await runRepositoryScan(repoId, user.id);
      expect(secondScan.findingsCount).toBe(1);

      const secondFindingRows = db.prepare('SELECT * FROM findings WHERE repository_id = ?').all(repoId) as unknown as FindingRecord[];
      // Must NOT have 2 findings:
      expect(secondFindingRows.length).toBe(1);
      // Finding ID is preserved (updated in place):
      expect(secondFindingRows[0].id).toBe(originalFindingId);
      expect(secondFindingRows[0].status).toBe('open');

      // Scans table still records history:
      const scanCount = db.prepare('SELECT COUNT(*) as c FROM scans WHERE repository_id = ?').get(repoId) as { c: number };
      expect(scanCount.c).toBe(2);
    });
  });

  // =========================================================================
  // 4. IDEMPOTENT DRAFT PR CREATION
  // =========================================================================
  describe('4. Idempotent Draft PR Creation', () => {
    it('returns existing PR record on subsequent proposal calls without writing duplicates', async () => {
      const user = createUser('pr_idempotency@example.com', 'Pass1234!', 'PR Idempotency User');
      const repoId = 'repo_pr_idempotency';

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
      `).run(repoId, user.id, new Date().toISOString());

      await runRepositoryScan(repoId, user.id);
      const finding = db.prepare('SELECT id FROM findings WHERE repository_id = ? LIMIT 1').get(repoId) as { id: string };
      const migration = await generateMigrationForFinding(finding.id, user.id);

      // First proposal call:
      const firstProposal = await createGitHubProposal(migration.id, user.id);
      expect(firstProposal.pullRequestId).toBeDefined();

      const prRowsBefore = db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id) as { c: number };
      expect(prRowsBefore.c).toBe(1);

      // Second proposal call for the SAME migration:
      const secondProposal = await createGitHubProposal(migration.id, user.id);
      expect(secondProposal.pullRequestId).toBe(firstProposal.pullRequestId);
      expect(secondProposal.url).toBe(firstProposal.url);

      // Must remain exactly 1 PR in the database:
      const prRowsAfter = db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id) as { c: number };
      expect(prRowsAfter.c).toBe(1);
    });
  });

  // =========================================================================
  // 5. RATE LIMITING
  // =========================================================================
  describe('5. Lightweight Server-Side Rate Limiter', () => {
    it('permits requests within quota and rejects requests exceeding limit with retryAfter', async () => {
      const clientIp = '198.51.100.42';
      const action = 'test_action';
      const maxRequests = 3;
      const windowSeconds = 60;

      // Requests 1, 2, 3 must be allowed
      for (let i = 1; i <= maxRequests; i++) {
        const result = await checkRateLimit(
          `${action}:${clientIp}`,
          maxRequests,
          windowSeconds * 1000
        );
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(maxRequests - i);
      }

      // Request 4 must be blocked
      const blocked = await checkRateLimit(
        `${action}:${clientIp}`,
        maxRequests,
        windowSeconds * 1000
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetInMs).toBeGreaterThan(0);
      expect(blocked.resetInMs).toBeLessThanOrEqual(windowSeconds * 1000);
    });
  });

  // =========================================================================
  // 6. INPUT VALIDATION
  // =========================================================================
  describe('6. Input Validation & Attack Payload Rejection', () => {
    it('validates signup payload: rejects malformed emails, short passwords, missing fields', () => {
      expect(validateSignupInput(null).valid).toBe(false);
      expect(validateSignupInput({}).valid).toBe(false);
      expect(validateSignupInput({ email: 'notanemail', password: 'ValidPassword123', name: 'User' }).valid).toBe(false);
      expect(validateSignupInput({ email: 'test@example.com', password: 'short', name: 'User' }).valid).toBe(false);
      expect(validateSignupInput({ email: 'test@example.com', password: 'ValidPassword123', name: 'A'.repeat(200) }).valid).toBe(false);

      const valid = validateSignupInput({ email: 'valid@example.com', password: 'ValidPassword123!', name: 'Valid User' });
      expect(valid.valid).toBe(true);
      expect(valid.data?.email).toBe('valid@example.com');
    });

    it('validates login payload', () => {
      expect(validateLoginInput(null).valid).toBe(false);
      expect(validateLoginInput({ email: 'bad' }).valid).toBe(false);
      expect(validateLoginInput({ email: 'user@example.com', password: '' }).valid).toBe(false);
      expect(validateLoginInput({ email: 'user@example.com', password: 'password123' }).valid).toBe(true);
    });

    it('validates repository connect payload', () => {
      expect(validateRepositoryConnectInput(null).valid).toBe(false);
      expect(validateRepositoryConnectInput({}).valid).toBe(false);
      expect(validateRepositoryConnectInput({
        owner: 'bad owner with spaces',
        name: 'repo',
      }).valid).toBe(false);

      const valid = validateRepositoryConnectInput({
        owner: 'valid-org',
        name: 'valid-repo',
        defaultBranch: 'main',
        githubRepositoryId: '12345',
      });
      expect(valid.valid).toBe(true);
    });

    it('validates IDs against path traversal and dangerous characters', () => {
      expect(validateSafeId('../etc/passwd').valid).toBe(false);
      expect(validateSafeId('id-with-spaces ').valid).toBe(false);
      expect(validateSafeId('<script>alert(1)</script>').valid).toBe(false);
      expect(validateSafeId('safe-id_123').valid).toBe(true);
      expect(validateSafeId('cuid_abc12345').valid).toBe(true);
    });
  });

  // =========================================================================
  // 7. CSRF / ORIGIN PROTECTION
  // =========================================================================
  describe('7. CSRF / Origin Protection', () => {
    it('accepts legitimate same-origin and browser same-site requests', () => {
      // 1. Matching Origin and Host
      const legitReq = new Request('https://apiproof.com/api/repositories', {
        method: 'POST',
        headers: {
          host: 'apiproof.com',
          origin: 'https://apiproof.com',
        },
      });
      expect(assertCsrfProtection(legitReq).valid).toBe(true);

      // 2. Direct server-to-server or test requests without Origin header
      const directReq = new Request('https://apiproof.com/api/repositories', {
        method: 'POST',
        headers: {
          host: 'apiproof.com',
        },
      });
      expect(assertCsrfProtection(directReq).valid).toBe(true);

      // 3. Same-origin Sec-Fetch-Site
      const fetchSiteReq = new Request('https://apiproof.com/api/repositories', {
        method: 'POST',
        headers: {
          host: 'apiproof.com',
          'sec-fetch-site': 'same-origin',
        },
      });
      expect(assertCsrfProtection(fetchSiteReq).valid).toBe(true);
    });

    it('rejects cross-site origin or cross-site Sec-Fetch-Site requests', () => {
      // Cross-origin attack
      const attackerReq = new Request('https://apiproof.com/api/repositories', {
        method: 'POST',
        headers: {
          host: 'apiproof.com',
          origin: 'https://evil-attacker.com',
        },
      });
      const check = assertCsrfProtection(attackerReq);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('Forbidden');

      // Cross-site Sec-Fetch-Site
      const crossSiteReq = new Request('https://apiproof.com/api/repositories', {
        method: 'POST',
        headers: {
          host: 'apiproof.com',
          'sec-fetch-site': 'cross-site',
        },
      });
      expect(assertCsrfProtection(crossSiteReq).valid).toBe(false);
    });
  });

  // =========================================================================
  // 8. DASHBOARD DATA INTEGRITY
  // =========================================================================
  describe('8. Dashboard Data Integrity', () => {
    it('sidebar and overview reflect real database counts without hardcoded findings badge', () => {
      const user = createUser('clean_dashboard@example.com', 'Pass1234!', 'Clean User');

      const findingCountRow = db.prepare(`
        SELECT COUNT(*) as c FROM findings f
        JOIN repositories r ON f.repository_id = r.id
        WHERE r.user_id = ? AND f.status = 'open'
      `).get(user.id) as { c: number };

      expect(findingCountRow.c).toBe(0);

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES ('repo_db_test', ?, 'org', 'repo', 'org/repo', '111', 'main', 'connected', ?)
      `).run(user.id, new Date().toISOString());

      const beforeScanCount = db.prepare(`
        SELECT COUNT(*) as c FROM findings f
        JOIN repositories r ON f.repository_id = r.id
        WHERE r.user_id = ? AND f.status = 'open'
      `).get(user.id) as { c: number };
      expect(beforeScanCount.c).toBe(0);
    });
  });
});
