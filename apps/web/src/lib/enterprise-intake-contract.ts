export type EnterpriseIntakeAvailability = {
  status: 'unavailable';
  code: 'NO_APPROVED_DESTINATION';
  heading: 'No message was sent';
  message: string;
};

/** Keep public inquiry submission explicitly non-sending until an owner-approved destination exists. */
export const enterpriseIntakeAvailability: EnterpriseIntakeAvailability = {
  status: 'unavailable',
  code: 'NO_APPROVED_DESTINATION',
  heading: 'No message was sent',
  message: 'Contact intake is not connected to a delivery service in this beta. Please use an owner-provided support channel before sharing sensitive details.',
};
