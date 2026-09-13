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
        <div className="p-6 space-y-5 text-xs">
          <div className="bg-[#EEF7F2] border border-[#D1EBE0] rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-emerald-950 space-y-1">
              <p className="font-semibold">Read-Only & Scoped Security Guarantee</p>
              <p className="text-emerald-800 leading-relaxed text-[11px]">
                APIProof operates in observe-only mode by default. Code analysis runs in memory without executing package scripts or altering repository files.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-[#686868] uppercase tracking-wider">
              App Permissions & Controls
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                <span className="text-[#111111] flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Metadata Access
                </span>
                <span className="font-mono text-[#686868] text-[11px]">Read-only</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                <span className="text-[#111111] flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Contents & Code Analysis
                </span>
                <span className="font-mono text-[#686868] text-[11px]">Read-only (Observe)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                <span className="text-[#111111] flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Pull Request Generation
                </span>
                <span className="font-mono text-emerald-700 font-semibold text-[11px]">Draft Mode Only</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                <span className="text-[#111111] flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-rose-600" /> Automatic Merging
                </span>
                <span className="font-mono text-rose-700 font-semibold text-[11px]">Strictly Blocked</span>
              </div>
            </div>
          </div>

          <div className="bg-[#FEF8EC] border border-[#FDE68A] rounded-2xl p-3.5 text-xs text-amber-950 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Connected Repositories in local pilot: <strong className="font-mono text-[#111111]">Bavio-Ai-v1</strong> and <strong className="font-mono text-[#111111]">apiproof-github-fixture</strong>.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F6F6F4] border-t border-[#E8E8E5] flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="font-medium">
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              alert('Demo Mode: ravitejabolla756-sys repositories are connected and indexed.');
              onClose();
            }}
            className="font-medium"
          >
            Configure GitHub App
          </Button>
        </div>
      </div>
    </div>
  );
}
