import { describe, expect, it } from 'vitest';
import { detectRepositoryLanguages, MultiLanguageRepositoryAnalyzer } from '@apiproof/analyzers';

describe('snapshot language detection', () => {
  it('returns deterministic candidates from filenames and manifests', () => {
    const result = detectRepositoryLanguages({
      'src/client.py': '', 'requirements.txt': '', 'go.mod': '', 'client.go': '',
      'pom.xml': '', 'src/Main.java': '', 'build.gradle.kts': '', 'src/App.kt': '',
      'App.csproj': '', 'src/App.cs': '', 'src/client.ts': '',
    });
    expect(result.map((item) => item.language)).toEqual(['csharp', 'go', 'java', 'kotlin', 'python', 'typescript']);
    expect(result.find((item) => item.language === 'python')?.evidence).toEqual(['requirements.txt', 'src/client.py']);
  });

  it('does not infer a language from provider names or arbitrary content', () => {
    expect(detectRepositoryLanguages({ 'README.md': 'openai github api' })).toEqual([]);
  });

  it('analyzes only detected languages and preserves evidence beside results', async () => {
    const result = await new MultiLanguageRepositoryAnalyzer().analyzeDetected({
      'requirements.txt': 'openai>=1.0\n',
      'client.py': 'import openai\nopenai.OpenAI()\n',
      'go.mod': 'module example.com/app\n',
      'client.go': 'package main\n',
      'README.md': 'not a source file',
    }, { id: 'openai', packageName: 'openai', constructorExports: ['OpenAI'] });
    expect(result.detected.map((item) => item.language)).toEqual(['go', 'python']);
    expect(result.scans.map((item) => item.language)).toEqual(['go', 'python']);
    expect(result.scans.every((item) => item.result.provider === 'openai')).toBe(true);
  });
});
