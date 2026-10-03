import { expect, it, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn());
vi.mock('stripe', () => ({ default: class { subscriptions = { create }; } }));

it('uses the migrated discounts contract without making a remote API request', async () => {
  await import('./billing.js');
  expect(create).toHaveBeenCalledWith({ customer: 'cus_controlled', coupon: 'launch' });
});
