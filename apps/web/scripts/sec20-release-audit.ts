import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const acceptedStatuses = new Set(['INTEGRATED_VERIFIED_LOCAL', 'PRODUCTION_VERIFIED']);
const expectedTaskIds = new Set([
  'SEC-04', 'SEC-08', 'SEC-09', 'SEC-15', 'SEC-16', 'SCAN-12', 'PROV-05', 'IMP-09', 'PR-07', 'PR-08',
  'AUTH-05', 'AUTH-10', 'ORG-05', 'ORG-10', 'MIG-01', 'BILL-02', 'BILL-03', 'BILL-04', 'BILL-10',
  'SEC-01', 'SEC-02', 'SEC-10', 'SEC-11', 'SEC-13', 'SEC-17', 'SEC-19', 'SEC-20',
  'AUTH-08', 'AUTH-09', 'UI-12', 'UI-13', 'ORG-02', 'ORG-03', 'ORG-04', 'ORG-11',
  'BILL-07', 'BILL-08', 'BILL-09', 'BILL-11', 'NOT-01', 'NOT-02', 'NOT-03', 'NOT-04', 'NOT-05', 'NOT-06',
  'NOT-10', 'WEB-08', 'WEB-11', 'WEB-12', 'WEB-13', 'WEB-14', 'WEB-15', 'SEC-18',
]);

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
  const taskIds = tasks.map((task) => task.id);
  const duplicateIds = [...new Set(taskIds.filter((id, index) => taskIds.indexOf(id) !== index))].sort();
  const missingIds = [...expectedTaskIds].filter((id) => !taskIds.includes(id)).sort();
  const unexpectedIds = [...new Set(taskIds.filter((id) => !expectedTaskIds.has(id)))].sort();
  if (duplicateIds.length) blockers.push(`TASK_INVENTORY_DUPLICATE_IDS:${duplicateIds.join(',')}`);
  if (missingIds.length) blockers.push(`TASK_INVENTORY_MISSING_IDS:${missingIds.join(',')}`);
  if (unexpectedIds.length) blockers.push(`TASK_INVENTORY_UNEXPECTED_IDS:${unexpectedIds.join(',')}`);
  if (unresolved.length) blockers.push(`UNRESOLVED_TASKS:${unresolved.length}`);
  if (tasks.some((task) => task.status === 'PRODUCTION_VERIFIED')) blockers.push('PRODUCTION_EVIDENCE_NOT_EVALUATED');
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
