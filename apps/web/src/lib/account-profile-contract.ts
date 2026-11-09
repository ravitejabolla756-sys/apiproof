export type AccountProfileProjection = {
  email: string;
  name: string;
  authProviders: string[];
  hasLocalPassword: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate the account profile projection before populating editable controls. */
export function parseAccountProfileResponse(value: unknown): AccountProfileProjection | null {
  if (!record(value) || !record(value.account) || !text(value.account.email) || !text(value.account.name)
    || !Array.isArray(value.account.authProviders) || !value.account.authProviders.every(text)
    || typeof value.account.hasLocalPassword !== 'boolean') return null;
  return {
    email: value.account.email,
    name: value.account.name,
    authProviders: value.account.authProviders,
    hasLocalPassword: value.account.hasLocalPassword,
  };
}
