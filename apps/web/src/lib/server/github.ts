import {
  loadGitHubAppConfig,
  assertLiveConfig,
  NodeGitHubAppTokenProvider,
  FetchGitHubReadTransport,
  GitHubAppSourceControlProvider,
} from '@apiproof/core';
import { EXCLUDED_DIRECTORIES } from '@apiproof/shared';

export interface GitHubRepoSummary {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  sha: string;
}

export function getGitHubProvider(): GitHubAppSourceControlProvider | null {
  const config = loadGitHubAppConfig();
  if (!config.enabled) {
    return null;
  }
  try {
    assertLiveConfig(config);
    const tokenProvider = new NodeGitHubAppTokenProvider(config);
    const transport = new FetchGitHubReadTransport();
    return new GitHubAppSourceControlProvider(config, tokenProvider, transport);
  } catch (error) {
    console.error('Failed to initialize GitHubAppSourceControlProvider:', error);
    return null;
  }
}

export async function fetchRemoteRepositoryFiles(
  provider: GitHubAppSourceControlProvider,
  targetSha?: string
): Promise<{ files: Map<string, string>; headSha: string; defaultBranch: string }> {
  const head = await provider.getDefaultBranch();
  const sha = targetSha ?? head.sha;
  const tree = await provider.readTree(sha);

  const filesMap = new Map<string, string>();
  const filesToFetch = tree.filter((file) =>
    file === 'package.json' ||
    (/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(file) &&
      !file.split('/').some((p) => EXCLUDED_DIRECTORIES.has(p) || p.startsWith('.')))
  );

  for (const filePath of filesToFetch) {
    try {
      const content = await provider.readFile(filePath, sha);
      filesMap.set(filePath, content);
    } catch (err) {
      console.warn(`Failed to read remote file ${filePath}:`, err);
    }
  }

  return { files: filesMap, headSha: sha, defaultBranch: head.name };
}

export async function getAccessibleRepositoryInfo(): Promise<GitHubRepoSummary | null> {
  const provider = getGitHubProvider();
  if (!provider) return null;

  try {
    const identity = await provider.getRepository();
    const head = await provider.getDefaultBranch();
    return {
      id: identity.repositoryId,
      owner: identity.owner,
      name: identity.repository,
      fullName: `${identity.owner}/${identity.repository}`,
      defaultBranch: head.name,
      sha: head.sha,
    };
  } catch (error) {
    console.error('Error fetching accessible repository info from GitHub App:', error);
    return null;
  }
}
