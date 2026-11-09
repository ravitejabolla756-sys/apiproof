export type StatusSourceAvailability = {
  status: 'unavailable';
  code: 'STATUS_SOURCE_NOT_CONFIGURED';
  message: string;
};

/**
 * Keep the public page truthful until an approved, server-validated status
 * source and freshness policy are integrated.
 */
export const statusSourceAvailability: StatusSourceAvailability = {
  status: 'unavailable',
  code: 'STATUS_SOURCE_NOT_CONFIGURED',
  message: 'No live monitor is connected to this public page yet, so it intentionally does not publish invented uptime, incident or “all systems operational” claims.',
};
