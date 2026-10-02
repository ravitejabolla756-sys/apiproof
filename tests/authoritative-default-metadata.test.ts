import { describe, expect, it, vi } from 'vitest';
import { FetchGitHubControlledWriteTransport, getInstallationRepository, GitHubAppSourceControlProvider, listInstallationRepositories, type GitHubAppConfig } from '@apiproof/core';

const config: GitHubAppConfig = { enabled: true, appId: '1', installationId: '2', repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture', mode: 'OBSERVE' };
const tokens = { getToken: async () => 'test-only-token' };

describe('authoritative repository metadata release boundary', () => {
  it.each(['main', 'master', 'trunk', 'develop', 'release/beta'])('preserves GitHub default branch %s without inventing main', async (branch) => {
    const response = { id: 1363070568, name: config.repository, full_name: `${config.owner}/${config.repository}`, owner: { login: config.owner }, default_branch: branch, private: false };
    const fetched = await getInstallationRepository('test-only-token', config.repositoryId, (async () => Response.json(response)) as typeof fetch);
    expect(fetched.defaultBranch).toBe(branch);
    const provider = new GitHubAppSourceControlProvider(config, tokens, { request: async () => ({ status: 200, body: response }) });
    expect((await provider.getRepository()).defaultBranch).toBe(branch);
  });
  it.each([undefined, '', 'main ', '../main'])('rejects missing/invalid metadata %s in both picker and live source provider', async (branch) => {
    const response = { id: 1363070568, name: config.repository, full_name: `${config.owner}/${config.repository}`, owner: { login: config.owner }, default_branch: branch };
    await expect(getInstallationRepository('test-only-token', config.repositoryId, (async () => Response.json(response)) as typeof fetch)).rejects.toThrow(/GITHUB_DEFAULT_BRANCH_UNVERIFIED/);
    await expect(listInstallationRepositories('test-only-token', {}, (async () => Response.json({ repositories: [response], total_count: 1 })) as typeof fetch)).rejects.toThrow(/GITHUB_DEFAULT_BRANCH_UNVERIFIED/);
    const provider = new GitHubAppSourceControlProvider(config, tokens, { request: async () => ({ status: 200, body: response }) });
    await expect(provider.getRepository()).rejects.toThrow(/GITHUB_DEFAULT_BRANCH_UNVERIFIED/);
  });
  it('rejects a repository response whose numeric identity does not match the requested repository', async () => {
    await expect(getInstallationRepository('test-only-token', config.repositoryId, (async () => Response.json({ id: 999, default_branch: 'main' })) as typeof fetch)).rejects.toThrow(/GITHUB_REPOSITORY_NOT_APPROVED/);
  });
  it('never mutates a default branch even when its name is inside the migration namespace', async () => {
    const fetcher = vi.fn();
    const branch = 'apiproof/change/run';
    const transport = new FetchGitHubControlledWriteTransport(config, tokens, fetcher, undefined, { authoritativeDefaultBranch: branch });
    await expect(transport.createBranchRef(branch, 'a'.repeat(40))).rejects.toThrow(/authoritative default branch/);
    await expect(transport.createCommit(branch, { 'src/index.ts': 'export const x = 1;' }, 'test', 'a'.repeat(40))).rejects.toThrow(/authoritative default branch/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
