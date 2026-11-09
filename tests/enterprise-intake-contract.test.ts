import { describe, expect, it } from 'vitest';
import { enterpriseIntakeAvailability } from '../apps/web/src/lib/enterprise-intake-contract.js';

describe('enterprise intake contract boundary', () => {
  it('keeps public inquiry submission unavailable without an approved destination', () => {
    expect(enterpriseIntakeAvailability).toEqual({
      status: 'unavailable',
      code: 'NO_APPROVED_DESTINATION',
      heading: 'No message was sent',
      message: 'Contact intake is not connected to a delivery service in this beta. Please use an owner-provided support channel before sharing sensitive details.',
    });
  });
});
