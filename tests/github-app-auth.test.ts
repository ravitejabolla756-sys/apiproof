import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizePrivateKeyPem,
  loadGitHubAppConfig,
  assertLiveConfig,
  NodeGitHubAppTokenProvider,
  type GitHubAppConfig,
} from '@apiproof/core';

describe('Vercel-Compatible GitHub App Authentication & Key Normalization', () => {
  // Generate an ephemeral test RSA key pair for testing real JWT creation without mocks
  const { privateKey: testPrivateKeyPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const baseConfig: GitHubAppConfig = {
    enabled: true,
    appId: '12345',
    installationId: '67890',
    repositoryId: '1363070568',
    owner: 'ravitejabolla756-sys',
    repository: 'apiproof-github-fixture',
    mode: 'OBSERVE',
  };

  describe('1. normalizePrivateKeyPem', () => {
    it('handles undefined, null, and empty strings safely', () => {
      expect(normalizePrivateKeyPem()).toBe('');
      expect(normalizePrivateKeyPem(null)).toBe('');
      expect(normalizePrivateKeyPem('')).toBe('');
      expect(normalizePrivateKeyPem('   ')).toBe('');
    });

    it('preserves keys with literal real newlines', () => {
      const normalized = normalizePrivateKeyPem(testPrivateKeyPem);
      expect(normalized).toBe(testPrivateKeyPem.trim());
      expect(normalized).toContain('-----BEGIN PRIVATE KEY-----');
      expect(normalized).toContain('-----END PRIVATE KEY-----');
    });

    it('correctly unescapes string with literal \\n characters', () => {
      const escaped = testPrivateKeyPem.replace(/\n/g, '\\n');
      const normalized = normalizePrivateKeyPem(escaped);
      expect(normalized).toBe(testPrivateKeyPem.trim());
      expect(normalized.split('\n').length).toBeGreaterThan(1);
    });

    it('correctly unescapes string with literal \\r\\n characters', () => {
      const escaped = testPrivateKeyPem.replace(/\n/g, '\\r\\n');
      const normalized = normalizePrivateKeyPem(escaped);
      expect(normalized).toBe(testPrivateKeyPem.trim());
    });

    it('strips enclosing double quotes with escaped newlines', () => {
      const quoted = `"${testPrivateKeyPem.replace(/\n/g, '\\n')}"`;
      const normalized = normalizePrivateKeyPem(quoted);
      expect(normalized).toBe(testPrivateKeyPem.trim());
    });

    it('strips enclosing single quotes with escaped newlines', () => {
      const quoted = `'${testPrivateKeyPem.replace(/\n/g, '\\n')}'`;
      const normalized = normalizePrivateKeyPem(quoted);
      expect(normalized).toBe(testPrivateKeyPem.trim());
    });

    it('normalizes Windows CRLF to standard LF', () => {
      const crlfKey = testPrivateKeyPem.replace(/\n/g, '\r\n');
      const normalized = normalizePrivateKeyPem(crlfKey);
      expect(normalized).toBe(testPrivateKeyPem.trim());
      expect(normalized).not.toContain('\r');
    });
  });

  describe('2. loadGitHubAppConfig', () => {
    it('loads GITHUB_APP_PRIVATE_KEY into config.privateKey', () => {
      const env: NodeJS.ProcessEnv = {
        APIPROOF_ENABLE_LIVE_GITHUB: 'true',
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY: testPrivateKeyPem.replace(/\n/g, '\\n'),
        GITHUB_INSTALLATION_ID: '67890',
        GITHUB_ALLOWED_REPOSITORY_ID: '1363070568',
        GITHUB_ALLOWED_REPOSITORY_OWNER: 'ravitejabolla756-sys',
        GITHUB_ALLOWED_REPOSITORY_NAME: 'apiproof-github-fixture',
      };

      const config = loadGitHubAppConfig(env);
      expect(config.enabled).toBe(true);
      expect(config.appId).toBe('12345');
      expect(config.privateKey).toBe(testPrivateKeyPem.trim());
      expect(config.privateKeyPath).toBe('');
    });

    it('supports GITHUB_APP_PRIVATE_KEY_PATH for local development fallback', () => {
      const env: NodeJS.ProcessEnv = {
        APIPROOF_ENABLE_LIVE_GITHUB: 'true',
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY_PATH: './local/keys/test.pem',
        GITHUB_INSTALLATION_ID: '67890',
        GITHUB_ALLOWED_REPOSITORY_ID: '1363070568',
        GITHUB_ALLOWED_REPOSITORY_OWNER: 'ravitejabolla756-sys',
        GITHUB_ALLOWED_REPOSITORY_NAME: 'apiproof-github-fixture',
      };

      const config = loadGitHubAppConfig(env);
      expect(config.privateKeyPath).toBe('./local/keys/test.pem');
      expect(config.privateKey).toBeUndefined();
    });

    it('prefers GITHUB_APP_PRIVATE_KEY when both are present', () => {
      const env: NodeJS.ProcessEnv = {
        APIPROOF_ENABLE_LIVE_GITHUB: 'true',
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY: testPrivateKeyPem,
        GITHUB_APP_PRIVATE_KEY_PATH: './local/keys/ignored.pem',
        GITHUB_INSTALLATION_ID: '67890',
        GITHUB_ALLOWED_REPOSITORY_ID: '1363070568',
        GITHUB_ALLOWED_REPOSITORY_OWNER: 'ravitejabolla756-sys',
        GITHUB_ALLOWED_REPOSITORY_NAME: 'apiproof-github-fixture',
      };

      const config = loadGitHubAppConfig(env);
      expect(config.privateKey).toBe(testPrivateKeyPem.trim());
      expect(config.privateKeyPath).toBe('./local/keys/ignored.pem');
    });
  });

  describe('3. assertLiveConfig Production vs Development Rules', () => {
    it('in development: passes when either privateKey or privateKeyPath is provided', () => {
      // With privateKey only
      expect(() =>
        assertLiveConfig({ ...baseConfig, privateKey: testPrivateKeyPem }, false)
      ).not.toThrow();

      // With privateKeyPath only
      expect(() =>
        assertLiveConfig({ ...baseConfig, privateKeyPath: 'dummy.pem' }, false)
      ).not.toThrow();

      // With both
      expect(() =>
        assertLiveConfig({ ...baseConfig, privateKey: testPrivateKeyPem, privateKeyPath: 'dummy.pem' }, false)
      ).not.toThrow();
    });

    it('in development: fails when neither privateKey nor privateKeyPath is provided', () => {
      expect(() =>
        assertLiveConfig({ ...baseConfig }, false)
      ).toThrow('GITHUB_CONFIG_MISSING_PRIVATEKEYPATH');
    });

    it('in production: requires GITHUB_APP_PRIVATE_KEY and rejects filesystem path fallback', () => {
      // Missing privateKey, but has privateKeyPath -> MUST FAIL in production
      expect(() =>
        assertLiveConfig({ ...baseConfig, privateKeyPath: '/tmp/local.pem' }, true)
      ).toThrow('GITHUB_CONFIG_MISSING_PRIVATE_KEY');

      // With privateKey provided -> MUST PASS in production
      expect(() =>
        assertLiveConfig({ ...baseConfig, privateKey: testPrivateKeyPem }, true)
      ).not.toThrow();
    });
  });

  describe('4. NodeGitHubAppTokenProvider with Environment Private Key', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('successfully signs JWT using direct config.privateKey and requests installation token', async () => {
      let authHeaderUsed = '';

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        authHeaderUsed = (init?.headers as Record<string, string>)?.Authorization ?? '';
        return {
          ok: true,
          status: 201,
          json: async () => ({
            token: 'ghs_live_test_token_12345',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          }),
        };
      });

      const provider = new NodeGitHubAppTokenProvider({
        ...baseConfig,
        privateKey: testPrivateKeyPem,
      });

      const token = await provider.getToken('67890', '1363070568');
      expect(token).toBe('ghs_live_test_token_12345');

      // Verify JWT structure: header.payload.signature
      expect(authHeaderUsed).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      const jwtParts = authHeaderUsed.replace('Bearer ', '').split('.');
      const payload = JSON.parse(Buffer.from(jwtParts[1]!, 'base64url').toString('utf8'));
      expect(payload.iss).toBe('12345');
    });

    it('in production: refuses to fall back to filesystem when privateKey is missing', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const provider = new NodeGitHubAppTokenProvider({
          ...baseConfig,
          privateKeyPath: 'dummy.pem',
        });

        await expect(provider.getToken('67890', '1363070568')).rejects.toThrow('GITHUB_PRIVATE_KEY_UNREADABLE');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('sanitizes malformed/corrupted keys without leaking key content or crypto trace', async () => {
      const malformedKey = '-----BEGIN RSA PRIVATE KEY-----\nNOT_VALID_BASE64_CORRUPTED===\n-----END RSA PRIVATE KEY-----';
      const provider = new NodeGitHubAppTokenProvider({
        ...baseConfig,
        privateKey: malformedKey,
      });

      try {
        await provider.getToken('67890', '1363070568');
        expect.unreachable();
      } catch (err) {
        const errorMsg = (err as Error).message;
        expect(errorMsg).toBe('GITHUB_PRIVATE_KEY_UNREADABLE');
        expect(errorMsg).not.toContain(malformedKey);
        expect(errorMsg).not.toContain('NOT_VALID_BASE64');
      }
    });
  });
});
