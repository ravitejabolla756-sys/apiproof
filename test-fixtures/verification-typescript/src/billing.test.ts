import { expect, it, vi } from 'vitest';

const mockSubscriptionsCreate = vi.hoisted(() => vi.fn());
vi.mock('stripe', () => ({ default: class { subscriptions = { create: mockSubscriptionsCreate }; } }));

it('uses the migrated discounts contract without making a remote API request', async () => {
  await import('./billing.js');
  expect(mockSubscriptionsCreate).toHaveBeenCalledWith({ customer: 'cus_controlled', coupon: 'launch' });
});
