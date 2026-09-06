import type { RepositoryIdentity } from './types.js';
import type { SourceControlProvider } from './provider.js';
import type { GitHubAppConfig } from './config.js';
export interface InstallationTokenProvider { getToken(installationId: string, repositoryId: string): Promise<string> }
export interface GitHubReadTransport { request(path: string, token: string): Promise<{ status: number; body: any }> }
export class GitHubAppSourceControlProvider implements Pick<SourceControlProvider,'getRepository'|'getDefaultBranch'|'readTree'|'readFile'|'operationAllowed'|'hasActiveProposal'> {
  constructor(private readonly config: GitHubAppConfig, private readonly tokens: InstallationTokenProvider, private readonly transport: GitHubReadTransport) {}
  private async read(path: string) { const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId); try { return await this.transport.request(path, token); } finally { /* token intentionally discarded */ } }
  async getRepository(): Promise<RepositoryIdentity> { const result=await this.read(`/repos/${this.config.owner}/${this.config.repository}`); if (String(result.body.id) !== this.config.repositoryId) throw new Error('GITHUB_REPOSITORY_NOT_APPROVED'); return { installationId:this.config.installationId, repositoryId:String(result.body.id), owner:result.body.owner.login, repository:result.body.name, defaultBranch:result.body.default_branch }; }
  async getDefaultBranch() { const repository=await this.getRepository(); const result=await this.read(`/repos/${repository.owner}/${repository.repository}/git/ref/heads/${repository.defaultBranch}`); return { name:repository.defaultBranch, sha:String(result.body.object.sha) }; }
  async readTree(sha:string) { const result=await this.read(`/repos/${this.config.owner}/${this.config.repository}/git/trees/${sha}?recursive=1`); return (result.body.tree ?? []).filter((entry:any)=>entry.type==='blob').map((entry:any)=>String(entry.path)); }
  async readFile(filePath:string,sha:string) { const result=await this.read(`/repos/${this.config.owner}/${this.config.repository}/contents/${filePath}?ref=${sha}`); return Buffer.from(String(result.body.content),'base64').toString('utf8'); }
  async hasActiveProposal() { return false; }
  operationAllowed(operation: any) { return ['READ_REPOSITORY','READ_FILE','READ_TREE','READ_OWN_PULL_REQUEST'].includes(operation); }
}
