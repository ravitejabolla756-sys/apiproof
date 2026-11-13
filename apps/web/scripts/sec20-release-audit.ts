import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const acceptedStatuses = new Set(['INTEGRATED_VERIFIED_LOCAL', 'PRODUCTION_VERIFIED']);

export interface ReleaseAuditTask {
  id: string;
  status: string;
}

export interface ReleaseAuditReport {
  status: 'GO' | 'NO_GO';
  evidenceBoundary: 'local_inventory_only';
  taskCount: number;
  acceptedTaskCount: number;
  unresolved: ReleaseAuditTask[];
  blockers: string[];
}

function readInventory(repositoryRootPath: string): string {
  return fs.readFileSync(path.join(repositoryRootPath, 'MY_OWL_V1_UNIFIED_DEVELOPMENT_AUDIT.md'), 'utf8');
}

export function buildReleaseAudit(repositoryRootPath = repositoryRoot): ReleaseAuditReport {
  const inventory = readInventory(repositoryRootPath);
  const tasks: ReleaseAuditTask[] = [];
  const rowPattern = /^\|\s*([A-Z]+-\d+)\s*\|\s*([^|]+)\|/gm;
  for (const match of inventory.matchAll(rowPattern)) {
    const id = match[1];
    const status = match[2];
    if (id && status) tasks.push({ id, status: status.trim() });
  }

  const unresolved = tasks.filter((task) => !acceptedStatuses.has(task.status));
  const blockers: string[] = [];
  if (tasks.length !== 53) blockers.push(`TASK_INVENTORY_COUNT_INVALID:${tasks.length}`);
  if (unresolved.length) blockers.push(`UNRESOLVED_TASKS:${unresolved.length}`);
  blockers.push('HOSTED_CI_AND_STAGING_EVIDENCE_NOT_EVALUATED');
  blockers.push('POSTGRESQL_PROVIDER_BACKUP_AND_LEGAL_GATES_REQUIRE_EXTERNAL_EVIDENCE');

  return {
    status: blockers.length === 0 ? 'GO' : 'NO_GO',
    evidenceBoundary: 'local_inventory_only',
    taskCount: tasks.length,
    acceptedTaskCount: tasks.filter((task) => acceptedStatuses.has(task.status)).length,
    unresolved,
    blockers,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  console.log(JSON.stringify(buildReleaseAudit(), null, 2));
  process.exitCode = 0;
}
