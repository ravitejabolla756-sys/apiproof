'use client';

import { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, Github, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConnectRepoModal({ isOpen, onClose, onSuccess }: ConnectRepoModalProps) {
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: owner.trim(),
          name: name.trim(),
          defaultBranch: defaultBranch.trim() || 'main',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect repository.');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-[#E8E8E5] w-full max-w-lg rounded-[24px] shadow-2xl overflow-hidden flex flex-col">
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
        <form onSubmit={handleConnect} className="p-6 space-y-5 text-xs">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Repository connected successfully! Updating workspace...</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                Repository Owner / Organization
              </label>
              <input
                type="text"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. acme-corp"
                className="w-full px-3 py-2 rounded-xl border border-[#E8E8E5] bg-white text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-purple-600/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                Repository Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. billing-service"
                className="w-full px-3 py-2 rounded-xl border border-[#E8E8E5] bg-white text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-purple-600/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                Default Branch
              </label>
              <input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 rounded-xl border border-[#E8E8E5] bg-white text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-purple-600/20 font-mono"
              />
            </div>
          </div>

          <div className="bg-[#EEF7F2] border border-[#D1EBE0] rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-emerald-800 leading-relaxed text-[11px]">
              APIProof operates in read-only observe mode by default. Code analysis runs in memory without executing package scripts or altering repository files.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#E8E8E5] flex items-center justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading} className="font-medium">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || success}
              className="font-medium gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Connecting...' : 'Connect & Monitor'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
