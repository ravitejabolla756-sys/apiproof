'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, CheckCircle2, Github, AlertCircle, Loader2, Search, ExternalLink, GitBranch, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GitHubRepoItem {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
}

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConnectRepoModal({ isOpen, onClose, onSuccess }: ConnectRepoModalProps) {
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [connected, setConnected] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepoItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function fetchAvailableRepos() {
      setLoadingRepos(true);
      setError(null);
      try {
        const res = await fetch('/api/github/repositories');
        if (!res.ok) {
          throw new Error('Failed to load GitHub repositories.');
        }
        const data = await res.json();
        if (isMounted) {
          setConnected(Boolean(data.connected));
          setRepositories(data.repositories || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) {
          setLoadingRepos(false);
        }
      }
    }

    fetchAvailableRepos();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleConnectGitHub() {
    setConnectingGitHub(true);
    setError(null);
    try {
      const res = await fetch('/api/github/install');
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to generate installation URL');
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate GitHub connection.');
      setConnectingGitHub(false);
    }
  }

  async function handleConnectRepository(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepoId) return;

    setSubmitting(true);
    setError(null);
    setStatusMessage('Connecting repository...');

    try {
      const res = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepositoryId: selectedRepoId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect repository.');
      }

      const connectedRepoId = data.repository?.id;

      // 1. Repository is connected -> Automatically initiate first scan
      if (connectedRepoId) {
        setStatusMessage('Repository connected. Starting initial AST compatibility scan...');
        try {
          const scanRes = await fetch(`/api/repositories/${connectedRepoId}/scan`, {
            method: 'POST',
          });
          const scanData = await scanRes.json();
          if (scanRes.ok && scanData.result) {
            const count = scanData.result.findingsCount ?? 0;
            setStatusMessage(`Initial scan completed: ${count} breaking change${count === 1 ? '' : 's'} identified.`);
          } else {
            // Non-fatal: repo connected, scan failed gracefully
            setStatusMessage('Repository connected. Initial scan can be run from the repository workbench.');
          }
        } catch {
          setStatusMessage('Repository connected. Initial scan can be run from the repository workbench.');
        }
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setStatusMessage(null);
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatusMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredRepos = repositories.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-[#E8E8E5] w-full max-w-lg rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E5] bg-[#F6F6F4]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <Github className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-[#111111]">Connect GitHub Repository</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-[#111111] rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-purple-900 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-700 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {success && !statusMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Repository connected successfully! Updating workspace...</span>
            </div>
          )}

          {loadingRepos ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#686868]">
              <Loader2 className="w-6 h-6 animate-spin text-purple-700" />
              <span className="text-xs">Loading available repositories...</span>
            </div>
          ) : !connected ? (
            <div className="py-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-700">
                <Github className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#111111]">GitHub App Not Connected</h4>
                <p className="text-xs text-[#686868] max-w-sm mx-auto">
                  Connect the APIProof GitHub App to your account or organization to grant repository access.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnectGitHub}
                disabled={connectingGitHub}
                className="gap-1.5"
              >
                {connectingGitHub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                <span>Connect GitHub</span>
              </Button>
            </div>
          ) : repositories.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#111111]">No Repositories Available</h4>
                <p className="text-xs text-[#686868] max-w-sm mx-auto">
                  The installed GitHub App does not have access to any repositories. Adjust your installation repository settings on GitHub.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectGitHub}
                disabled={connectingGitHub}
                className="gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Adjust Repositories</span>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleConnectRepository} className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8E8E5] bg-white text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-purple-600/20"
                />
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredRepos.map((repo) => {
                  const isSelected = selectedRepoId === repo.id;
                  return (
                    <div
                      key={repo.id}
                      onClick={() => setSelectedRepoId(repo.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/50'
                          : 'border-[#E8E8E5] bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-xs text-[#111111] flex items-center gap-1.5">
                          {repo.fullName}
                          {repo.private ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-normal bg-zinc-100 text-zinc-600">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-normal bg-emerald-50 text-emerald-700">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#686868] flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-zinc-400" />
                          <span>{repo.defaultBranch}</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="selectedRepo"
                        checked={isSelected}
                        onChange={() => setSelectedRepoId(repo.id)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#EEF7F2] border border-[#D1EBE0] rounded-2xl p-3.5 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-emerald-800 leading-relaxed text-[11px]">
                  Connecting a repository authorizes APIProof in read-only observe mode. Real AST compatibility scans run in memory without altering repository files.
                </p>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-[#E8E8E5] flex items-center justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!selectedRepoId || submitting || success}
                  className="gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Connecting...' : 'Connect Repository'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
