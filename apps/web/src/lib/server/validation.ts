import { isTestRuntime } from './runtime-mode.js';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const GITHUB_NAME_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;
const GIT_BRANCH_REGEX = /^[a-zA-Z0-9/_.-]{1,100}$/;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_.-]{1,150}$/;

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

export function validateSignupInput(body: unknown): ValidationResult<{ email: string; password: string; name: string }> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const { email, password, name } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return { valid: false, error: 'Name is required (1-100 characters).' };
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 255) {
    return { valid: false, error: 'A valid email address is required (max 255 characters).' };
  }

  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters.' };
  }

  return {
    valid: true,
    data: {
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
    },
  };
}

export function validateLoginInput(body: unknown): ValidationResult<{ email: string; password: string }> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return { valid: false, error: 'A valid email address is required.' };
  }

  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required.' };
  }

  return {
    valid: true,
    data: {
      email: email.trim().toLowerCase(),
      password,
    },
  };
}

export function validatePasswordResetRequestInput(body: unknown): ValidationResult<{ email: string }> {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object.' };
  const email = (body as Record<string, unknown>).email;
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 255) {
    return { valid: false, error: 'A valid email address is required.' };
  }
  return { valid: true, data: { email: email.trim().toLowerCase() } };
}

export function validatePasswordResetCompletionInput(body: unknown): ValidationResult<{ token: string; password: string }> {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object.' };
  const { token, password } = body as Record<string, unknown>;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { valid: false, error: 'A valid password reset token is required.' };
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return { valid: false, error: 'Password must be 8-128 characters long.' };
  }
  return { valid: true, data: { token, password } };
}

export function validateAccountDisplayNameInput(body: unknown): ValidationResult<{ name: string }> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const name = (body as Record<string, unknown>).name;
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return { valid: false, error: 'Name is required (1-100 characters).' };
  }
  return { valid: true, data: { name: name.trim() } };
}

export function validatePasswordChangeInput(body: unknown): ValidationResult<{
  currentPassword: string;
  newPassword: string;
}> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const { currentPassword, newPassword } = body as Record<string, unknown>;
  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return { valid: false, error: 'Current password is required.' };
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return { valid: false, error: 'New password must be 8-128 characters long.' };
  }
  if (currentPassword === newPassword) {
    return { valid: false, error: 'New password must be different from the current password.' };
  }
  return { valid: true, data: { currentPassword, newPassword } };
}

export function validateRepositoryConnectInput(body: unknown): ValidationResult<{
  owner?: string;
  name?: string;
  defaultBranch?: string;
  githubRepositoryId?: string;
}> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  const { owner, name, defaultBranch, githubRepositoryId } = body as Record<string, unknown>;

  const gitHubId = typeof githubRepositoryId === 'string' || typeof githubRepositoryId === 'number'
    ? String(githubRepositoryId).trim()
    : undefined;

  // Modern Phase 3A: githubRepositoryId alone is sufficient
  if (gitHubId !== undefined) {
    if (!/^\d+$/.test(gitHubId)) {
      return { valid: false, error: 'Invalid githubRepositoryId format.' };
    }
    const data: {
      owner?: string;
      name?: string;
      defaultBranch?: string;
      githubRepositoryId: string;
    } = { githubRepositoryId: gitHubId };

    if (typeof owner === 'string' && GITHUB_NAME_REGEX.test(owner.trim())) {
      data.owner = owner.trim();
    }
    if (typeof name === 'string' && GITHUB_NAME_REGEX.test(name.trim())) {
      data.name = name.trim();
    }
    if (typeof defaultBranch === 'string' && GIT_BRANCH_REGEX.test(defaultBranch.trim())) {
      data.defaultBranch = defaultBranch.trim();
    }
    return { valid: true, data };
  }

  // Legacy fallback: owner and name are required
  if (typeof owner !== 'string' || !GITHUB_NAME_REGEX.test(owner.trim())) {
    return { valid: false, error: 'Invalid repository owner/organization name.' };
  }

  if (typeof name !== 'string' || !GITHUB_NAME_REGEX.test(name.trim())) {
    return { valid: false, error: 'Invalid repository name.' };
  }

  const branch = typeof defaultBranch === 'string' && defaultBranch.trim().length > 0
    ? defaultBranch.trim()
    : 'main';

  if (!GIT_BRANCH_REGEX.test(branch)) {
    return { valid: false, error: 'Invalid default branch format.' };
  }

  return {
    valid: true,
    data: {
      owner: owner.trim(),
      name: name.trim(),
      defaultBranch: branch,
    },
  };
}

export function validateSafeId(id: unknown, fieldName = 'ID'): ValidationResult<string> {
  if (typeof id !== 'string' || !SAFE_ID_REGEX.test(id)) {
    return { valid: false, error: `Invalid ${fieldName} parameter format.` };
  }
  return { valid: true, data: id.trim() };
}

/**
 * Validates Origin and Sec-Fetch-Site to protect mutating API routes from cross-site requests.
 */
export function assertCsrfProtection(req: Request): { valid: boolean; error?: string } {
  const isTest = isTestRuntime();

  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return { valid: false, error: 'Forbidden: Cross-site request rejected.' };
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return { valid: false, error: 'Forbidden: Origin header does not match host.' };
      }
    } catch {
      return { valid: false, error: 'Forbidden: Invalid Origin header.' };
    }
  } else if (!origin && !isTest) {
    const referer = req.headers.get('referer');
    if (referer && host) {
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== host) {
          return { valid: false, error: 'Forbidden: Referer header does not match host.' };
        }
      } catch {
        return { valid: false, error: 'Forbidden: Invalid Referer header.' };
      }
    }
  }

  return { valid: true };
}

export function badRequestResponse(error: string): Response {
  return Response.json({ error, code: 'INVALID_REQUEST_PAYLOAD' }, { status: 400 });
}

export function forbiddenCsrfResponse(error = 'Forbidden: Cross-site request rejected.'): Response {
  return Response.json({ error, code: 'CSRF_REJECTED' }, { status: 403 });
}
