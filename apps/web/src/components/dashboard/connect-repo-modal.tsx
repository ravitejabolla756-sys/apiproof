'use client';

import { X, ShieldCheck, Lock, CheckCircle2, Github, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectRepoModal({ isOpen, onClose }: ConnectRepoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#12141c] border border-[#262b3d] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2333] bg-[#0e1017]">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Github className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">Connect GitHub Repository</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-200 space-y-1">
              <p className="font-semibold">Read-Only & Scoped Security Guarantee</p>
              <p className="text-sky-300/80 leading-relaxed">
                APIProof operates in observe-only mode by default. Code analysis runs in memory without executing package scripts or altering repository files.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              App Permissions & Controls
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-md bg-[#161924] border border-[#222738]">
                <span className="text-zinc-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Metadata Access
                </span>
                <span className="font-mono text-zinc-400 text-[11px]">Read-only</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-[#161924] border border-[#222738]">
                <span className="text-zinc-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Contents & Code Analysis
                </span>
                <span className="font-mono text-zinc-400 text-[11px]">Read-only (Observe)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-[#161924] border border-[#222738]">
                <span className="text-zinc-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Pull Request Generation
                </span>
                <span className="font-mono text-emerald-400 text-[11px]">Draft Mode Only</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-[#161924] border border-[#222738]">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-400" /> Automatic Merging
                </span>
                <span className="font-mono text-rose-400 text-[11px]">Strictly Blocked</span>
              </div>
            </div>
          </div>

          <div className="bg-[#171a26] border border-[#262b3d] rounded-lg p-3 text-xs text-zinc-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Connected Repositories in local pilot: <strong className="text-zinc-200 font-mono">Bavio-Ai-v1</strong> and <strong className="text-zinc-200 font-mono">apiproof-github-fixture</strong>.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0a0b10] border-t border-[#1f2333] flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              alert('Demo Mode: ravitejabolla756-sys repositories are connected and indexed.');
              onClose();
            }}
          >
            Configure GitHub App
          </Button>
        </div>
      </div>
    </div>
  );
}
