import type { ApiChange, Diagnostic, ImpactFinding, ScanResult } from '@apiproof/shared';

/** Syntax information needed by a language adapter, without provider-specific AST code. */
export interface ProviderDescriptor {
  id: string;
  packageName: string;
  constructorExports: readonly string[];
}

export interface ApiProvider {
  readonly descriptor: ProviderDescriptor;
  validateChange(input: unknown): ApiChange;
  matchImpact(scan: ScanResult, change: ApiChange): {
    impacts: ImpactFinding[];
    diagnostics: Diagnostic[];
  };
}

export interface RepositoryAnalyzer {
  readonly language: 'typescript';
  analyze(repositoryPath: string, provider: ProviderDescriptor): Promise<ScanResult>;
}
