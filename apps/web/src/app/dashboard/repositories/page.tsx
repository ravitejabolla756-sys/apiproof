'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderGit2, Search, Filter, ShieldCheck, GitPullRequest, ArrowRight, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConnectRepoModal } from '@/components/dashboard/connect-repo-modal';
import { DEMO_REPOSITORIES } from '@/lib/demo-data';

export default function RepositoriesPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'healthy' | 'affected'>('all');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const filteredRepos = DEMO_REPOSITORIES.filter((repo) => {
    const matchesSearch = repo.name.toLowerCase().includes(query.toLowerCase()) || repo.providers.some((p) => p.toLowerCase().includes(query.toLowerCase()));
    if (filter === 'healthy') return matchesSearch && repo.status === 'healthy';
    if (filter === 'affected') return matchesSearch && repo.status !== 'healthy';
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2333] pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-sky-400" />
            Repositories
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Connected repositories monitored by APIProof GitHub App.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsConnectModalOpen(true)}
          icon={<FolderGit2 className="h-3.5 w-3.5" />}
        >
          Connect Repository
        </Button>
      </div>

      {/* Controls: Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#12141c] border border-[#1f2333] p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by repo name or SDK..."
            className="w-full bg-[#0d0e14] border border-[#222738] rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <div className="flex items-center bg-[#0d0e14] border border-[#222738] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md transition-all ${
                filter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({DEMO_REPOSITORIES.length})
            </button>
            <button
              onClick={() => setFilter('healthy')}
              className={`px-3 py-1 rounded-md transition-all ${
                filter === 'healthy' ? 'bg-zinc-800 text-emerald-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Healthy (1)
            </button>
            <button
              onClick={() => setFilter('affected')}
              className={`px-3 py-1 rounded-md transition-all ${
                filter === 'affected' ? 'bg-zinc-800 text-rose-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Affected / PR (1)
            </button>
          </div>
        </div>
      </div>

      {/* Repositories Table / Cards */}
      <div className="space-y-4">
        {filteredRepos.map((repo) => (
          <Card key={repo.id} className="p-5 hover:border-zinc-700 transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/dashboard/repositories/${repo.id}`}
                    className="font-mono text-base font-bold text-zinc-100 hover:text-sky-400 transition-colors flex items-center gap-2"
                  >
                    {repo.name}
                  </Link>
                  <Badge variant={repo.status === 'healthy' ? 'healthy' : 'info'}>
                    {repo.statusLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                  <span className="font-mono text-zinc-500">Branch: <strong className="text-zinc-300">{repo.defaultBranch}</strong></span>
                  <span className="text-zinc-600">•</span>
                  <span>Files Analyzed: <strong className="text-zinc-300 font-mono">{repo.totalFiles}</strong></span>
                  <span className="text-zinc-600">•</span>
                  <span>Last scan: <strong className="text-zinc-300 font-mono">{repo.lastScanAt}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {repo.id === 'apiproof-github-fixture' && (
                  <a
                    href="https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-400 hover:bg-sky-500/20 transition-all flex items-center gap-1.5"
                  >
                    <GitPullRequest className="h-3.5 w-3.5" /> Draft PR #1 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Link
                  href={`/dashboard/repositories/${repo.id}`}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-xs font-medium text-zinc-200 transition-all flex items-center gap-1.5"
                >
                  View Details <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Providers Tag Bar */}
            <div className="mt-4 pt-3 border-t border-[#1f2333] flex items-center justify-between text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-500 font-mono text-[11px] mr-1">Detected SDKs:</span>
                {repo.providers.map((p) => (
                  <span key={p} className="bg-[#171a26] text-zinc-300 border border-[#222738] px-2 py-0.5 rounded text-[11px] font-mono">
                    {p}
                  </span>
                ))}
              </div>
              {repo.status === 'healthy' ? (
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> 0 Breaking Changes
                </span>
              ) : (
                <span className="text-rose-400 font-mono text-[11px]">1 Action Required</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <ConnectRepoModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
    </div>
  );
}
