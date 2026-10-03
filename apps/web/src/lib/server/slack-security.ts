import crypto from 'node:crypto';
import { getVerifierSecret } from '@apiproof/core';

export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
export interface EncryptedSlackToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function decodeEncryptionKey(): Buffer {
  const encoded = process.env.SLACK_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error('SLACK_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error('SLACK_TOKEN_ENCRYPTION_KEY_INVALID');
  }
  return key;
}

export function getSlackOAuthConfig(): SlackOAuthConfig {
  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  const configuredBase = process.env.APIPROOF_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!clientId || !clientSecret || !configuredBase) throw new Error('SLACK_OAUTH_NOT_CONFIGURED');
  const base = new URL(configuredBase);
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') throw new Error('SLACK_OAUTH_HTTPS_REQUIRED');
  return { clientId, clientSecret, redirectUri: new URL('/api/slack/callback', base).toString() };
}

export function encryptSlackToken(token: string): EncryptedSlackToken {
  if (!token || token.length > 4096) throw new Error('SLACK_TOKEN_INVALID');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', decodeEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

export function decryptSlackToken(value: EncryptedSlackToken): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', decodeEncryptionKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

export function hashSlackOpaqueValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createSlackActionValue(input: { deliveryId: string; action: 'create_pr' | 'dismiss'; expiresAt: string }): string {
  const payload = Buffer.from(`${input.deliveryId}\n${input.action}\n${input.expiresAt}`).toString('base64url');
  const signature = crypto.createHmac('sha256', getVerifierSecret()).update(`slack-action:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySlackActionValue(value: string): { deliveryId: string; action: 'create_pr' | 'dismiss'; expiresAt: string } | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', getVerifierSecret()).update(`slack-action:${payload}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  let decoded: string;
  try { decoded = Buffer.from(payload, 'base64url').toString('utf8'); } catch { return null; }
  const [deliveryId, action, expiresAt, extraPart] = decoded.split('\n');
  if (!deliveryId || (action !== 'create_pr' && action !== 'dismiss') || !expiresAt || extraPart) return null;
  if (!/^[A-Za-z0-9_.-]{1,150}$/.test(deliveryId) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) return null;
  return { deliveryId, action, expiresAt };
}

export function verifySlackRequestSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  nowMs?: number;
}): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret || !input.timestamp || !input.signature || !/^\d{1,12}$/.test(input.timestamp)) return false;
  const timestampSeconds = Number(input.timestamp);
  const ageSeconds = Math.abs(Math.floor((input.nowMs ?? Date.now()) / 1000) - timestampSeconds);
  if (ageSeconds > 300) return false;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${input.timestamp}:${input.rawBody}`).digest('hex')}`;
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(input.signature);
  return expectedBytes.length === signatureBytes.length && crypto.timingSafeEqual(expectedBytes, signatureBytes);
}
