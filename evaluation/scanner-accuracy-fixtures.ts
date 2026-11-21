import type { ProviderDescriptor } from '@apiproof/core';
import type { SupportedLanguage } from '@apiproof/shared';

export type ScannerBenchmarkCaseKind = 'positive' | 'negative' | 'edge' | 'malformed';
export type ScannerBenchmarkEcosystem = Extract<SupportedLanguage, 'typescript' | 'python' | 'go' | 'java' | 'kotlin' | 'csharp'>;

export type ScannerBenchmarkProvider = ProviderDescriptor & {
  readonly packageNames?: readonly string[];
  readonly coordinates?: readonly string[];
  readonly namespaceNames?: readonly string[];
  readonly apiDomains?: readonly string[];
  readonly environmentVariables?: readonly string[];
};

export type ScannerBenchmarkCase = {
  readonly id: string;
  readonly ecosystem: ScannerBenchmarkEcosystem;
  readonly kind: ScannerBenchmarkCaseKind;
  readonly provider: ScannerBenchmarkProvider;
  readonly files: Readonly<Record<string, string>>;
  readonly groundTruth: {
    readonly providerId: string;
    readonly packageName: string | null;
    readonly version: string | null;
    readonly providerUsed: boolean;
  };
};

const tsProvider: ScannerBenchmarkProvider = { id: 'openai', packageName: 'openai', constructorExports: ['OpenAI'] };
const pythonProvider: ScannerBenchmarkProvider = { id: 'openai', packageName: 'openai', packageNames: ['openai'], constructorExports: [] };
const goProvider: ScannerBenchmarkProvider = { id: 'openai', packageName: 'github.com/openai/openai-go', constructorExports: [], packageNames: ['github.com/openai/openai-go'] };
const jvmProvider: ScannerBenchmarkProvider = {
  id: 'openai', packageName: 'org.openai', constructorExports: [], packageNames: ['org.openai'], coordinates: ['org.openai:openai-java'],
};
const dotnetProvider: ScannerBenchmarkProvider = {
  id: 'openai', packageName: 'OpenAI', constructorExports: ['OpenAIClient'], packageNames: ['OpenAI'], namespaceNames: ['OpenAI'],
};

const packageJson = (version: string, packageName = 'openai'): string => JSON.stringify({ name: 'scanner-benchmark-fixture', private: true, dependencies: { [packageName]: version } });
const packageLock = (version: string): string => JSON.stringify({ name: 'scanner-benchmark-fixture', lockfileVersion: 3, packages: { '': { dependencies: { openai: `^${version}` } }, [`node_modules/openai`]: { version } } });

const cases: ScannerBenchmarkCase[] = [
  {
    id: 'typescript-positive-package-and-import', ecosystem: 'typescript', kind: 'positive', provider: tsProvider,
    files: { 'package.json': packageJson('4.1.0'), 'src/client.ts': 'import OpenAI from "openai";\nconst client = new OpenAI();\nclient.responses.create({ model: "gpt-4.1" });\n' },
    groundTruth: { providerId: 'openai', packageName: 'openai', version: '4.1.0', providerUsed: true },
  },
  {
    id: 'typescript-negative-near-match', ecosystem: 'typescript', kind: 'negative', provider: tsProvider,
    files: { 'package.json': packageJson('4.1.0', 'openai-tools'), 'src/client.ts': 'import tools from "openai-tools";\nvoid tools;\n' },
    groundTruth: { providerId: 'openai', packageName: null, version: null, providerUsed: false },
  },
  {
    id: 'typescript-edge-lockfile-and-subpath-import', ecosystem: 'typescript', kind: 'edge', provider: tsProvider,
    files: {
      'package.json': packageJson('4.2.0'), 'package-lock.json': packageLock('4.2.0'),
      'src/client.ts': 'import { OpenAI } from "openai/resources";\nexport const client = new OpenAI();\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'openai', version: '4.2.0', providerUsed: true },
  },
  {
    id: 'typescript-malformed-source-with-package', ecosystem: 'typescript', kind: 'malformed', provider: tsProvider,
    files: { 'package.json': packageJson('4.3.0'), 'src/broken.ts': 'import OpenAI from "openai";\nfunction broken( {\nconst client = new OpenAI();\n' },
    groundTruth: { providerId: 'openai', packageName: 'openai', version: '4.3.0', providerUsed: true },
  },

  {
    id: 'python-positive-requirements-and-import', ecosystem: 'python', kind: 'positive', provider: pythonProvider,
    files: { 'requirements.txt': 'openai==1.51.0\n', 'client.py': 'from openai import OpenAI\nclient = OpenAI()\nclient.responses.create(model="gpt-4.1")\n' },
    groundTruth: { providerId: 'openai', packageName: 'openai', version: '1.51.0', providerUsed: true },
  },
  {
    id: 'python-negative-near-match', ecosystem: 'python', kind: 'negative', provider: pythonProvider,
    files: { 'requirements.txt': 'openai-tools==1.0.0\n', 'client.py': 'import openai_tools\nopenai_tools.run()\n' },
    groundTruth: { providerId: 'openai', packageName: null, version: null, providerUsed: false },
  },
  {
    id: 'python-edge-uv-lock-and-alias', ecosystem: 'python', kind: 'edge', provider: pythonProvider,
    files: {
      'requirements-dev.txt': 'openai>=1.52.0\n',
      'uv.lock': '[[package]]\nname = "openai"\nversion = "1.52.0"\n',
      'client.py': 'import openai as sdk\nclient = sdk.OpenAI()\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'openai', version: '1.52.0', providerUsed: true },
  },
  {
    id: 'python-malformed-source-with-package', ecosystem: 'python', kind: 'malformed', provider: pythonProvider,
    files: { 'requirements.txt': 'openai==1.53.0\n', 'broken.py': 'from openai import OpenAI\nclient = OpenAI(\n' },
    groundTruth: { providerId: 'openai', packageName: 'openai', version: '1.53.0', providerUsed: true },
  },

  {
    id: 'go-positive-module-and-import', ecosystem: 'go', kind: 'positive', provider: goProvider,
    files: {
      'go.mod': 'module example.com/app\n\nrequire github.com/openai/openai-go v1.3.0\n',
      'go.sum': 'github.com/openai/openai-go v1.3.0 h1:fixture\n',
      'client.go': 'package main\nimport openai "github.com/openai/openai-go"\nfunc run() { client := openai.NewClient(); _ = client }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'github.com/openai/openai-go', version: '1.3.0', providerUsed: true },
  },
  {
    id: 'go-negative-near-match', ecosystem: 'go', kind: 'negative', provider: goProvider,
    files: { 'go.mod': 'module example.com/app\n\nrequire github.com/openai/openai-tools v1.0.0\n', 'client.go': 'package main\nimport "github.com/openai/openai-tools"\n' },
    groundTruth: { providerId: 'openai', packageName: null, version: null, providerUsed: false },
  },
  {
    id: 'go-edge-submodule-and-v-prefix', ecosystem: 'go', kind: 'edge', provider: goProvider,
    files: {
      'go.mod': 'module example.com/app\n\nrequire github.com/openai/openai-go v1.4.0\n',
      'go.sum': 'github.com/openai/openai-go v1.4.0 h1:fixture\n',
      'client.go': 'package main\nimport "github.com/openai/openai-go/option"\nfunc run() { option.WithMaxRetries(2) }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'github.com/openai/openai-go', version: '1.4.0', providerUsed: true },
  },
  {
    id: 'go-malformed-source-with-module', ecosystem: 'go', kind: 'malformed', provider: goProvider,
    files: { 'go.mod': 'module example.com/app\n\nrequire github.com/openai/openai-go v1.5.0\n', 'go.sum': 'github.com/openai/openai-go v1.5.0 h1:fixture\n', 'broken.go': 'package main\nimport "github.com/openai/openai-go"\nfunc run( {\n' },
    groundTruth: { providerId: 'openai', packageName: 'github.com/openai/openai-go', version: '1.5.0', providerUsed: true },
  },

  {
    id: 'java-positive-pom-and-import', ecosystem: 'java', kind: 'positive', provider: jvmProvider,
    files: {
      'pom.xml': '<project><dependencies><dependency><groupId>org.openai</groupId><artifactId>openai-java</artifactId><version>1.4.0</version></dependency></dependencies></project>',
      'Client.java': 'import org.openai.OpenAIClient;\nclass Client { void run() { OpenAIClient client = new OpenAIClient(); client.responses(); } }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'org.openai:openai-java', version: '1.4.0', providerUsed: true },
  },
  {
    id: 'java-negative-near-match', ecosystem: 'java', kind: 'negative', provider: jvmProvider,
    files: {
      'pom.xml': '<project><dependencies><dependency><groupId>org.openai-tools</groupId><artifactId>tools</artifactId><version>1.0.0</version></dependency></dependencies></project>',
      'Client.java': 'import com.other.openai.tools.Client;\nclass Client { }\n',
    },
    groundTruth: { providerId: 'openai', packageName: null, version: null, providerUsed: false },
  },
  {
    id: 'java-edge-gradle-coordinate', ecosystem: 'java', kind: 'edge', provider: jvmProvider,
    files: {
      'build.gradle': 'dependencies { implementation("org.openai:openai-java:1.5.0") }\n',
      'Client.java': 'import org.openai.OpenAIClient;\nclass Client { OpenAIClient client; }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'org.openai:openai-java', version: '1.5.0', providerUsed: true },
  },
  {
    id: 'java-malformed-source-with-pom', ecosystem: 'java', kind: 'malformed', provider: jvmProvider,
    files: {
      'pom.xml': '<project><dependencies><dependency><groupId>org.openai</groupId><artifactId>openai-java</artifactId><version>1.6.0</version></dependency></dependencies></project>',
      'Broken.java': 'import org.openai.OpenAIClient;\nclass Broken { void run( {\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'org.openai:openai-java', version: '1.6.0', providerUsed: true },
  },

  {
    id: 'kotlin-positive-gradle-and-import', ecosystem: 'kotlin', kind: 'positive', provider: jvmProvider,
    files: {
      'build.gradle.kts': 'dependencies { implementation("org.openai:openai-java:1.4.0") }\n',
      'Client.kt': 'import org.openai.OpenAIClient\nclass Client { fun run() { val client = OpenAIClient() } }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'org.openai:openai-java', version: '1.4.0', providerUsed: true },
  },
  {
    id: 'kotlin-negative-near-match', ecosystem: 'kotlin', kind: 'negative', provider: jvmProvider,
    files: {
      'build.gradle.kts': 'dependencies { implementation("org.openai-tools:tools:1.0.0") }\n',
      'Client.kt': 'import com.other.openai.tools.Client\nclass Client\n',
    },
    groundTruth: { providerId: 'openai', packageName: null, version: null, providerUsed: false },
  },
  {
    id: 'kotlin-edge-gradle-kts-coordinate', ecosystem: 'kotlin', kind: 'edge', provider: jvmProvider,
    files: {
      'build.gradle.kts': 'dependencies { api("org.openai:openai-java:1.5.0") }\n',
      'Client.kt': 'import org.openai.OpenAIClient\ntypealias AiClient = OpenAIClient\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'org.openai:openai-java', version: '1.5.0', providerUsed: true },
  },
  {
    id: 'kotlin-malformed-source-with-gradle', ecosystem: 'kotlin', kind: 'malformed', provider: jvmProvider,
    files: {
      'build.gradle.kts': 'dependencies { implementation("org.openai:openai-java:1.6.0") }\n',
      'Broken.kt': 'import org.openai.OpenAIClient\nclass Broken { fun run( {\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'org.openai:openai-java', version: '1.6.0', providerUsed: true },
  },

  {
    id: 'csharp-positive-package-and-using', ecosystem: 'csharp', kind: 'positive', provider: dotnetProvider,
    files: {
      'Client.csproj': '<Project><ItemGroup><PackageReference Include="OpenAI" Version="2.0.0" /></ItemGroup></Project>',
      'Client.cs': 'using OpenAI;\nclass Client { void Run() { var client = new OpenAIClient(); client.Responses(); } }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'OpenAI', version: '2.0.0', providerUsed: true },
  },
  {
    id: 'csharp-negative-near-match', ecosystem: 'csharp', kind: 'negative', provider: dotnetProvider,
    files: {
      'Client.csproj': '<Project><ItemGroup><PackageReference Include="OpenAIExtensions" Version="1.0.0" /></ItemGroup></Project>',
      'Client.cs': 'using OpenAIExtensions;\nclass Client { }\n',
    },
    groundTruth: { providerId: 'openai', packageName: null, version: null, providerUsed: false },
  },
  {
    id: 'csharp-edge-package-version-item', ecosystem: 'csharp', kind: 'edge', provider: dotnetProvider,
    files: {
      'Directory.Build.props': '<Project><ItemGroup><PackageVersion Include="OpenAI" Version="2.1.0" /></ItemGroup></Project>',
      'Client.cs': 'using Ai = OpenAI;\nclass Client { void Run() { var client = new Ai.OpenAIClient(); } }\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'OpenAI', version: '2.1.0', providerUsed: true },
  },
  {
    id: 'csharp-malformed-source-with-package', ecosystem: 'csharp', kind: 'malformed', provider: dotnetProvider,
    files: {
      'Client.csproj': '<Project><ItemGroup><PackageReference Include="OpenAI" Version="2.2.0" /></ItemGroup></Project>',
      'Broken.cs': 'using OpenAI;\nclass Broken { void Run( {\n',
    },
    groundTruth: { providerId: 'openai', packageName: 'OpenAI', version: '2.2.0', providerUsed: true },
  },
];

export const SCANNER_ACCURACY_CASES: readonly ScannerBenchmarkCase[] = cases.slice().sort((left, right) => left.id.localeCompare(right.id, 'en'));

export const SCANNER_ACCURACY_ECOSYSTEMS: readonly ScannerBenchmarkEcosystem[] = ['csharp', 'go', 'java', 'kotlin', 'python', 'typescript'];
