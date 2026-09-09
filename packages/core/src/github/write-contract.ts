import { validateBranchName } from './branch-policy.js';
import { validatePatchScope } from './patch-scope.js';
import { verifyEvidenceBinding, type VerificationEvidence } from './verification-evidence.js';
import { calculateIdempotencyKey } from './idempotency.js';

export interface ControlledWriteRequest {
  repository: {
    repositoryId: string;
    owner: string;
    repository: string;
    defaultBranch: string;
  };
  baseline: {
    exactSha: string;
  };
  change: {
    changeId: string;
  };
  migration: {
    planId: string;
    patchDigest: string;
    allowedFiles: string[];
    patchContent: Record<string, string>;
  };
  branch: {
    branchName: string;
  };
  verification: VerificationEvidence;
}

export interface ControlledWriteValidationResult {
  valid: boolean;
  status?: string;
  reason?: string;
  idempotencyKey?: string;
}

export function validateControlledWriteRequest(
  request: ControlledWriteRequest,
  expectedPolicy?: {
    repositoryId: string;
    owner: string;
    repository: string;
  }
): ControlledWriteValidationResult {
  if (!request || typeof request !== 'object') {
    return { valid: false, status: 'GITHUB_OPERATION_REJECTED', reason: 'Controlled write request object is missing.' };
  }

  // Repository identity validation
  if (!request.repository || !request.repository.repositoryId || !request.repository.owner || !request.repository.repository || !request.repository.defaultBranch) {
    return { valid: false, status: 'GITHUB_REPOSITORY_NOT_APPROVED', reason: 'Controlled write request repository identity incomplete.' };
  }
  if (expectedPolicy) {
    if (request.repository.repositoryId !== expectedPolicy.repositoryId ||
        request.repository.owner !== expectedPolicy.owner ||
        request.repository.repository !== expectedPolicy.repository) {
      return { valid: false, status: 'GITHUB_REPOSITORY_NOT_APPROVED', reason: 'Controlled write request repository identity does not match expected allowlisted policy.' };
    }
  }

  // Baseline SHA validation
  if (!request.baseline || !request.baseline.exactSha || !/^[0-9a-f]{40}$/i.test(request.baseline.exactSha)) {
    return { valid: false, status: 'GITHUB_BASE_CHANGED', reason: 'Controlled write request baseline SHA invalid or missing.' };
  }

  // Change ID validation
  if (!request.change || !request.change.changeId) {
    return { valid: false, status: 'GITHUB_OPERATION_REJECTED', reason: 'Controlled write request change ID missing.' };
  }

  // Branch policy validation
  if (!request.branch || !request.branch.branchName) {
    return { valid: false, status: 'GITHUB_INVALID_BRANCH_NAME', reason: 'Controlled write request branch name missing.' };
  }
  const branchValidation = validateBranchName(request.branch.branchName);
  if (!branchValidation.valid) {
    return { valid: false, status: 'GITHUB_INVALID_BRANCH_NAME', reason: branchValidation.reason ?? 'Invalid branch name.' };
  }

  // Migration & patch scope validation
  if (!request.migration || !request.migration.patchDigest || !Array.isArray(request.migration.allowedFiles) || !request.migration.patchContent) {
    return { valid: false, status: 'GITHUB_SCOPE_VIOLATION', reason: 'Controlled write request migration patch metadata incomplete.' };
  }
  const patchFiles = Object.keys(request.migration.patchContent);
  const scopeValidation = validatePatchScope(patchFiles, request.migration.allowedFiles);
  if (!scopeValidation.valid) {
    const status = scopeValidation.forbiddenFile ? 'GITHUB_FORBIDDEN_PATH' : 'GITHUB_SCOPE_VIOLATION';
    return { valid: false, status, reason: scopeValidation.reason ?? 'Scope violation.' };
  }

  // Verification evidence binding check
  const evidenceValidation = verifyEvidenceBinding(request.verification, {
    repositoryId: request.repository.repositoryId,
    baselineSha: request.baseline.exactSha,
    changeId: request.change.changeId,
    patchDigest: request.migration.patchDigest,
  });
  if (!evidenceValidation.valid) {
    return { valid: false, status: 'GITHUB_EVIDENCE_MISMATCH', reason: evidenceValidation.reason ?? 'Evidence mismatch.' };
  }

  const idempotencyKey = calculateIdempotencyKey({
    repositoryId: request.repository.repositoryId,
    baselineSha: request.baseline.exactSha,
    changeId: request.change.changeId,
    patchDigest: request.migration.patchDigest,
  });

  return { valid: true, idempotencyKey };
}
