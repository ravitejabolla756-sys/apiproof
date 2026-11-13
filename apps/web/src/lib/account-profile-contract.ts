export type AccountProfileProjection = {
  email: string;
  name: string;
  authProviders: string[];
  hasLocalPassword: boolean;
  emailVerifiedAt: string | null;
  emailVerificationState: 'verified' | 'unverified' | 'unavailable';
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseAccountProfileResponse(value: unknown): AccountProfileProjection | null {
  if (!record(value) || !record(value.account) || !text(value.account.email) || !text(value.account.name)
    || !Array.isArray(value.account.authProviders) || !value.account.authProviders.every(text)
    || typeof value.account.hasLocalPassword !== 'boolean') return null;
  const emailVerifiedAt = value.account.emailVerifiedAt === null || typeof value.account.emailVerifiedAt === 'string'
    ? value.account.emailVerifiedAt
    : null;
  const emailVerificationState = value.account.emailVerificationState === 'verified'
    || value.account.emailVerificationState === 'unverified'
    || value.account.emailVerificationState === 'unavailable'
    ? value.account.emailVerificationState
    : 'unavailable';
  return {
    email: value.account.email,
    name: value.account.name,
    authProviders: value.account.authProviders,
    hasLocalPassword: value.account.hasLocalPassword,
    emailVerifiedAt,
    emailVerificationState,
  };
}

export function parsePasswordChangeResponse(value: unknown): string | null {
  if (!record(value) || value.success !== true || !text(value.message)) return null;
  return value.message;
}
