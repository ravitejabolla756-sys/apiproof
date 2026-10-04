import type { ApiChange, Diagnostic, ImpactFinding, ScanResult } from '@apiproof/shared';
import { LanguageChangeStrategySchema, SupportedLanguageSchema } from '@apiproof/shared';
import type { LanguageChangeStrategy, SupportedLanguage } from '@apiproof/shared';

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
  readonly language: SupportedLanguage;
  analyze(repositoryPath: string | unknown, provider: ProviderDescriptor): Promise<ScanResult>;
}

/** Registry boundary for language adapters; this does not imply an adapter is implemented or production-enabled. */
export class LanguageAnalyzerRegistry<T extends { readonly language: SupportedLanguage }> {
  private readonly adapters = new Map<SupportedLanguage, T>();

  register(adapter: T): void {
    const language = SupportedLanguageSchema.parse(adapter.language);
    if (this.adapters.has(language)) throw new Error(`LANGUAGE_ANALYZER_DUPLICATE:${language}`);
    this.adapters.set(language, adapter);
  }

  get(language: SupportedLanguage): T | undefined {
    return this.adapters.get(SupportedLanguageSchema.parse(language));
  }

  supportedLanguages(): SupportedLanguage[] {
    return [...this.adapters.keys()].sort();
  }
}

/** One vendor/internal change can register separate detection/fix strategies by language. */
export class LanguageChangeStrategyRegistry {
  private readonly strategies = new Map<string, LanguageChangeStrategy>();

  register(input: LanguageChangeStrategy): void {
    const strategy = LanguageChangeStrategySchema.parse(input);
    const key = `${strategy.changeId}:${strategy.language}`;
    if (this.strategies.has(key)) throw new Error(`LANGUAGE_CHANGE_STRATEGY_DUPLICATE:${key}`);
    this.strategies.set(key, strategy);
  }

  get(changeId: string, language: SupportedLanguage): LanguageChangeStrategy | undefined {
    return this.strategies.get(`${changeId}:${SupportedLanguageSchema.parse(language)}`);
  }
}
