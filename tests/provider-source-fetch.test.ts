import { describe, expect, it } from 'vitest';
import { fetchOfficialSource } from '../apps/web/src/lib/server/provider-source-fetch.js';

const source = { sourceUrl: 'https://provider.example/changelog' };
const row = { id: 'source-1', content_hash: null, etag: null, last_modified: null };
const okResponse = () => new Response('official source', { status: 200, headers: { 'content-type': 'text/plain' } });

describe('provider source DNS safety', () => {
  it('rejects IPv4-mapped IPv6 loopback answers before fetching', async () => {
    const fetchImpl = async () => okResponse();
    const resolveHost = async () => [{ address: '::ffff:127.0.0.1' }];

    await expect(fetchOfficialSource(source, row, { fetchImpl, resolveHost })).rejects.toThrow('SOURCE_HOST_RESOLVES_PRIVATE');
  });

  it('rejects hexadecimal IPv4-mapped IPv6 loopback answers before fetching', async () => {
    const fetchImpl = async () => okResponse();
    const resolveHost = async () => [{ address: '0:0:0:0:0:ffff:7f00:1' }];

    await expect(fetchOfficialSource(source, row, { fetchImpl, resolveHost })).rejects.toThrow('SOURCE_HOST_RESOLVES_PRIVATE');
  });

  it('allows a public address and returns the bounded response', async () => {
    let requests = 0;
    const fetchImpl = async () => {
      requests += 1;
      return okResponse();
    };
    const resolveHost = async () => [{ address: '203.0.113.10' }];

    await expect(fetchOfficialSource(source, row, { fetchImpl, resolveHost })).resolves.toMatchObject({ status: 200, body: 'official source' });
    expect(requests).toBe(1);
  });
});
