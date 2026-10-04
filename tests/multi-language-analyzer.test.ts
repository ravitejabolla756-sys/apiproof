import { describe, expect, it } from 'vitest';
import { CSharpRepositoryAnalyzer, GoRepositoryAnalyzer, MultiLanguageRepositoryAnalyzer, PythonRepositoryAnalyzer, TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';

const provider = { id: 'openai', packageName: 'openai', constructorExports: ['OpenAI'], apiDomains: ['api.openai.com'], environmentVariables: ['OPENAI_API_KEY'] };

describe('explicit multi-language analyzer dispatch', () => {
  it('keeps TypeScript as the backwards-compatible default and exposes registered languages', async () => {
    const analyzer = new MultiLanguageRepositoryAnalyzer();
    expect(analyzer.supportedLanguages()).toEqual(['csharp', 'go', 'java', 'kotlin', 'python', 'typescript']);
    const result = await analyzer.analyze(new Map([['src/client.ts', 'import OpenAI from "openai";']]), provider);
    expect(result.language).toBe('typescript');
  });

  it('routes explicit language requests to the corresponding adapter', async () => {
    const analyzer = new MultiLanguageRepositoryAnalyzer([new TypeScriptRepositoryAnalyzer(), new PythonRepositoryAnalyzer(), new GoRepositoryAnalyzer(), new CSharpRepositoryAnalyzer()]);
    const python = await analyzer.analyzeLanguage('python', { 'client.py': 'import openai\nopenai.OpenAI()\n' }, provider);
    const go = await analyzer.analyzeLanguage('go', { 'client.go': 'package main\nimport "openai"\n' }, provider);
    expect(python.language).toBe('python');
    expect(go.language).toBe('go');
  });

  it('fails closed for a language without a registered adapter', async () => {
    const analyzer = new MultiLanguageRepositoryAnalyzer();
    await expect(analyzer.analyzeLanguage('ruby', {}, provider)).rejects.toThrow('LANGUAGE_ANALYZER_UNSUPPORTED:ruby');
  });
});
