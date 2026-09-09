import { Project, ts } from 'ts-morph';
import type { RepositoryAnalyzer, ProviderDescriptor } from '@apiproof/core';
import type { ScanResult } from '@apiproof/shared';
import { TOOL_VERSION } from '@apiproof/shared';
import { RepositorySnapshot } from './repository.js';
import { detectDependencies } from './dependencies.js';
import { detectUsages } from './usages.js';

export class TypeScriptRepositoryAnalyzer implements RepositoryAnalyzer {
  readonly language = 'typescript' as const;

  async analyze(repositoryPath: string | RepositorySnapshot, provider: ProviderDescriptor): Promise<ScanResult> {
    const snapshot = typeof repositoryPath === 'string' ? await RepositorySnapshot.load(repositoryPath) : repositoryPath;
    const dependencies = await detectDependencies(snapshot, provider.packageName);
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true, skipLoadingLibFiles: true,
      compilerOptions: { noLib: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext, jsx: ts.JsxEmit.Preserve, strict: true } });
    const sources = [...snapshot.sources].map(([file, content]) => project.createSourceFile(`/repository/${file}`, content));
    // Only syntactic diagnostics: dependency installation and semantic compilation are intentionally out of scope.
    const program = project.getProgram().compilerObject;
    for (const source of sources) {
      if (program.getSyntacticDiagnostics(source.compilerNode).length) snapshot.warn('SYNTAX_ERROR', 'TypeScript contains syntax errors; findings may be incomplete.', source.getFilePath().replace('/repository/', ''));
    }
    const usages = detectUsages(sources, provider, snapshot);
    return {
      schemaVersion: '1.2', provider: provider.id, language: 'typescript',
      providerUsed: dependencies.length > 0 || usages.length > 0,
      dependencies, usages, diagnostics: snapshot.diagnostics,
      coverage: {
        scope: 'supported-static-patterns', filesAnalyzed: sources.length,
        filesSkipped: snapshot.skipped, complete: snapshot.diagnostics.length === 0,
        limitations: [
          'Only .ts, .tsx, .mts and .cts files outside hidden, dependency and build directories are analyzed.',
          'No tsconfig path aliases, dynamic module resolution, arbitrary function-return inference, or whole-program dataflow.',
          'No semantic compilation, runtime API-version verification, or API behavior verification.',
          'Local imports resolve within the source snapshot; package exports maps and project references are not interpreted.',
        ],
      },
      audit: { toolVersion: TOOL_VERSION, inputDigest: snapshot.digest(), mode: 'static-read-only' },
    };
  }
}
