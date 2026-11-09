import { toSafeExternalUrl } from './external-link-contract.js';

/**
 * Keep provider-supplied pull-request links inert unless they are absolute,
 * credential-free HTTPS URLs. Host allowlisting remains a shared backend
 * contract decision and is intentionally not inferred by this adapter.
 */
export function toSafePullRequestUrl(value: string | null | undefined): string | null {
  return toSafeExternalUrl(value);
}
