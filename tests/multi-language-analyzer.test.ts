import { describe, expect, it } from 'vitest';
import { CSharpRepositoryAnalyzer, GoRepositoryAnalyzer, JavaRepositoryAnalyzer, MultiLanguageRepositoryAnalyzer, PythonRepositoryAnalyzer, TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';

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

  it.each([
    ['python', new PythonRepositoryAnalyzer(), { 'client.py': 'import openai\nclient = openai.OpenAI(api_version="2024-10-01")\n' }],
    ['go', new GoRepositoryAnalyzer(), { 'client.go': 'package main\nimport "openai"\nfunc run() { client := openai.NewClient()\nheaders := map[string]string{"apiVersion": "2024-10-01"}\n_ = headers\n_ = client }\n' }],
    ['java', new JavaRepositoryAnalyzer(), { 'Client.java': 'import openai.OpenAI;\nclass Client { void run() { OpenAI client = new OpenAI();\nString apiVersion = "2024-10-01";\nclient.responses(); } }\n' }],
    ['csharp', new CSharpRepositoryAnalyzer(), { 'Client.cs': 'using openai;\nclass Client { void Run() { var client = new OpenAIClient();\nvar apiVersion = "2024-10-01";\nclient.Responses(); } }\n' }],
  ] as const)('propagates explicit API-version literals through the %s adapter', async (_language, adapter, files) => {
    const result = await adapter.analyze(files, provider);
    expect(result.usageIR?.some((usage) => usage.apiVersion === '2024-10-01')).toBe(true);
  });
});
