import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSec17RollbackEvidence } from '../src/lib/server/sec17-rollback-evidence.js';

const inputPath = process.argv[2];
if (!inputPath || path.isAbsolute(inputPath) || inputPath.split(/[\\/]/u).includes('..')) {
  throw new Error('SEC17_RELATIVE_EVIDENCE_PATH_REQUIRED');
}

const workspaceRoot = path.resolve(process.cwd());
const resolvedPath = path.resolve(workspaceRoot, inputPath);
if (!resolvedPath.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error('SEC17_EVIDENCE_PATH_OUTSIDE_WORKSPACE');

let parsed: unknown;
try {
  parsed = JSON.parse(await fs.readFile(resolvedPath, 'utf8')) as unknown;
} catch {
  throw new Error('SEC17_EVIDENCE_JSON_UNREADABLE');
}

try {
  const evidence = validateSec17RollbackEvidence(parsed);
  console.log(JSON.stringify({
    valid: true,
    environment: evidence.environment,
    candidateCommitSha: evidence.candidate.commitSha,
    knownGoodCommitSha: evidence.knownGood.commitSha,
    rollbackResult: evidence.rollback.result,
    migrationDisposition: evidence.migrationDisposition,
    productionPromotionObserved: evidence.productionPromotionObserved,
  }));
} catch {
  throw new Error('SEC17_EVIDENCE_INVALID');
}
