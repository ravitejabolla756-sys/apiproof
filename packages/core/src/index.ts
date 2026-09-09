import { createHash } from 'node:crypto';
import { ImpactResultSchema, ScanResultSchema } from '@apiproof/shared';
import type { ImpactResult, ScanResult, MigrationPlan, PlanningInput } from '@apiproof/shared';
import type { ApiProvider, RepositoryAnalyzer } from './contracts.js';

export * from './contracts.js';
export * from './evaluation/index.js';
export * from './planning/index.js';
export * from './patching/index.js';
export * from './verification/index.js';
export * from './contracts/index.js';
export * from './github/index.js';

export class ApiProof {
  constructor(private readonly analyzer: RepositoryAnalyzer, private readonly provider: ApiProvider) {}

  async scan(repositoryPath: string | unknown): Promise<ScanResult> {
    return ScanResultSchema.parse(await this.analyzer.analyze(repositoryPath, this.provider.descriptor));
  }

  async impact(repositoryPath: string | unknown, input: unknown): Promise<ImpactResult> {
    const change = this.provider.validateChange(input);
    const scan = await this.scan(repositoryPath);
    const { impacts, diagnostics } = this.provider.matchImpact(scan, change);
    return ImpactResultSchema.parse({
      schemaVersion: '1.2', analysisMode: change.provenance === 'synthetic' ? 'fixture' : 'reviewed-registry', change,
      changeDigest: createHash('sha256').update(JSON.stringify(change)).digest('hex'),
      status: impacts.length > 0 ? 'potentially-affected'
        : scan.coverage.complete && !diagnostics.some((item) => item.reasonCode === 'INSUFFICIENT_STATIC_EVIDENCE') ? 'no-matched-usage' : 'inconclusive',
      scan, impacts, diagnostics,
      verification: { status: 'not-run', reason: 'Static analysis only; no code or API behavior was executed.' },
    });
  }

  async planningInput(repositoryPath: string, input: unknown): Promise<PlanningInput> {
    const impact = await this.impact(repositoryPath, input);
    const { buildPlanningContext } = await import('./planning/context.js');
    return buildPlanningContext(repositoryPath, impact);
  }

  async plan(repositoryPath: string, input: unknown): Promise<MigrationPlan> {
    const context = await this.planningInput(repositoryPath, input);
    const { DeterministicPlanner } = await import('./planning/deterministic.js');
    return new DeterministicPlanner().plan(context);
  }
}
