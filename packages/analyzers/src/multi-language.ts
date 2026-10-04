import type { ProviderDescriptor, RepositoryAnalyzer } from '@apiproof/core';
import type { ScanResult, SupportedLanguage } from '@apiproof/shared';
import { PythonRepositoryAnalyzer } from './python/index.js';
import { GoRepositoryAnalyzer } from './go/index.js';
import { TypeScriptRepositoryAnalyzer } from './typescript/index.js';
import { JavaRepositoryAnalyzer, KotlinRepositoryAnalyzer } from './jvm/index.js';
import { CSharpRepositoryAnalyzer } from './dotnet/index.js';

export type RepositoryInput = string | unknown;
export type LanguageRepositoryAnalyzer = RepositoryAnalyzer & { readonly language: SupportedLanguage };

export type LanguageEvidence = { language: SupportedLanguage; evidence: string[] };
export type LanguageScan = { language: SupportedLanguage; result: ScanResult };
export type DetectedLanguageScan = { detected: LanguageEvidence[]; scans: LanguageScan[] };

/** Detects candidate languages from snapshot filenames only; it never guesses from provider names or code content. */
export function detectRepositoryLanguages(files: ReadonlyMap<string, string> | Record<string, string>): LanguageEvidence[] {
  const paths = [...(files instanceof Map ? files.keys() : Object.keys(files))].map((file) => file.replaceAll('\\', '/')).sort((a, b) => a.localeCompare(b, 'en'));
  const evidence = new Map<SupportedLanguage, Set<string>>();
  const add = (language: SupportedLanguage, file: string): void => { const current = evidence.get(language) ?? new Set<string>(); current.add(file); evidence.set(language, current); };
  for (const file of paths) {
    if (/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(file)) add('typescript', file);
    if (/\.pyi?$/i.test(file) || /(?:^|\/)pyproject\.toml$|(?:^|\/)requirements(?:-[^/]+)?\.txt$/i.test(file)) add('python', file);
    if (/\.go$/i.test(file) || /(?:^|\/)go\.mod$|(?:^|\/)go\.sum$/i.test(file)) add('go', file);
    if (/\.java$/i.test(file) || /(?:^|\/)pom\.xml$|(?:^|\/)build\.gradle$/i.test(file)) add('java', file);
    if (/\.kt$/i.test(file) || /(?:^|\/)build\.gradle\.kts$/i.test(file)) add('kotlin', file);
    if (/\.cs$/i.test(file) || /\.(?:csproj|props|sln|config)$/i.test(file)) add('csharp', file);
  }
  return [...evidence].sort(([left], [right]) => left.localeCompare(right, 'en')).map(([language, filesForLanguage]) => ({ language, evidence: [...filesForLanguage].sort((a, b) => a.localeCompare(b, 'en')) }));
}

/**
 * Explicit language dispatch for the shared analyzer contract. The legacy
 * `analyze` method remains TypeScript-first for existing callers; new callers
 * must select a language rather than relying on filename guessing.
 */
export class MultiLanguageRepositoryAnalyzer implements RepositoryAnalyzer {
  readonly language = 'typescript' as const;
  private readonly adapters = new Map<SupportedLanguage, LanguageRepositoryAnalyzer>();

  constructor(adapters: readonly LanguageRepositoryAnalyzer[] = [new TypeScriptRepositoryAnalyzer(), new PythonRepositoryAnalyzer(), new GoRepositoryAnalyzer(), new JavaRepositoryAnalyzer(), new KotlinRepositoryAnalyzer(), new CSharpRepositoryAnalyzer()]) {
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.language)) throw new Error(`LANGUAGE_ANALYZER_DUPLICATE:${adapter.language}`);
      this.adapters.set(adapter.language, adapter);
    }
    if (!this.adapters.has('typescript')) throw new Error('LANGUAGE_ANALYZER_TYPESCRIPT_REQUIRED');
  }

  supportedLanguages(): SupportedLanguage[] { return [...this.adapters.keys()].sort((a, b) => a.localeCompare(b, 'en')); }

  adapter(language: SupportedLanguage): LanguageRepositoryAnalyzer {
    const adapter = this.adapters.get(language);
    if (!adapter) throw new Error(`LANGUAGE_ANALYZER_UNSUPPORTED:${language}`);
    return adapter;
  }

  async analyze(repositoryPath: RepositoryInput, provider: ProviderDescriptor): Promise<ScanResult> {
    return this.adapter('typescript').analyze(repositoryPath, provider);
  }

  async analyzeLanguage(language: SupportedLanguage, repositoryPath: RepositoryInput, provider: ProviderDescriptor): Promise<ScanResult> {
    return this.adapter(language).analyze(repositoryPath, provider);
  }

  /** Runs only adapters supported by explicit filename evidence in a snapshot. */
  async analyzeDetected(repositoryPath: Map<string, string> | Record<string, string>, provider: ProviderDescriptor): Promise<DetectedLanguageScan> {
    const detected = detectRepositoryLanguages(repositoryPath);
    const scans: LanguageScan[] = [];
    for (const candidate of detected) {
      const adapter = this.adapters.get(candidate.language);
      if (!adapter) continue;
      scans.push({ language: candidate.language, result: await adapter.analyze(repositoryPath, provider) });
    }
    return { detected, scans };
  }
}
