import { describe, expect, it } from 'vitest';
import { getClientIp } from '../apps/web/src/lib/server/rate-limit.js';

describe('rate-limit client IP parsing', () => {
  it('uses the first valid IPv4 or IPv6 address from the forwarded chain', () => {
    expect(getClientIp(new Request('https://apiproof.test', { headers: { 'x-forwarded-for': ' 198.51.100.17, 10.0.0.4' } }))).toBe('198.51.100.17');
    expect(getClientIp(new Request('https://apiproof.test', { headers: { 'x-forwarded-for': '2001:db8::1, 2001:db8::2' } }))).toBe('2001:db8::1');
  });

  it('ignores malformed forwarded values and uses a valid real IP or loopback fallback', () => {
    expect(getClientIp(new Request('https://apiproof.test', { headers: { 'x-forwarded-for': `${'1'.repeat(600)}, 10.0.0.4`, 'x-real-ip': '203.0.113.4' } }))).toBe('203.0.113.4');
    expect(getClientIp(new Request('https://apiproof.test', { headers: { 'x-forwarded-for': 'not-an-ip' } }))).toBe('127.0.0.1');
    expect(getClientIp(new Request('https://apiproof.test', { headers: { 'x-real-ip': 'spoofed-value' } }))).toBe('127.0.0.1');
  });
});
