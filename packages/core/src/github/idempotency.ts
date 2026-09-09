import crypto from 'node:crypto';

export interface IdempotencyRecord {
  idempotencyKey: string;
  repositoryId: string;
  baselineSha: string;
  changeId: string;
  patchDigest: string;
  branchName: string;
  createdAt: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  prNumber?: number;
  prUrl?: string;
}

export function calculateIdempotencyKey(input: {
  repositoryId: string;
  baselineSha: string;
  changeId: string;
  patchDigest: string;
}): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${input.repositoryId}:${input.baselineSha}:${input.changeId}:${input.patchDigest}`);
  return `apiproof-idemp-${hash.digest('hex').slice(0, 32)}`;
}

export class InMemoryIdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async has(key: string): Promise<boolean> {
    return this.records.has(key);
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    return this.records.get(key);
  }

  async record(key: string, record: IdempotencyRecord): Promise<void> {
    this.records.set(key, record);
  }
}
