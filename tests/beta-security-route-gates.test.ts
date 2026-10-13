import { describe, expect, it } from 'vitest';
import { POST as checkoutPost } from '../apps/web/src/app/api/billing/checkout/route.js';
import { POST as portalPost } from '../apps/web/src/app/api/billing/portal/route.js';
import { DELETE as repositoryDelete } from '../apps/web/src/app/api/repositories/[id]/route.js';

function crossSiteRequest(url: string, method: string): Request {
  return new Request(url, {
    method,
    headers: { 'sec-fetch-site': 'cross-site' },
  });
}

describe('beta mutation route security gates', () => {
  it('rejects cross-site billing checkout requests before external billing work', async () => {
    const response = await checkoutPost(crossSiteRequest('http://localhost/api/billing/checkout', 'POST'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('rejects cross-site billing portal requests before external billing work', async () => {
    const response = await portalPost(crossSiteRequest('http://localhost/api/billing/portal', 'POST'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('rejects cross-site repository deletion before database mutation', async () => {
    const response = await repositoryDelete(
      crossSiteRequest('http://localhost/api/repositories/repo_test', 'DELETE'),
      { params: Promise.resolve({ id: 'repo_test' }) },
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'CSRF_REJECTED' });
  });
});
