"use client";

import { useState } from "react";
import Link from "next/link";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import {
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowUpRight,
} from "lucide-react";

export function CompatibilityMap() {
  const [selectedRepo, setSelectedRepo] = useState<string>("bavio-ai-v1");
  const currentRepo = demoData.repositories.find((r) => r.id === selectedRepo) || demoData.repositories[0] || {
    id: "bavio-ai-v1",
    name: "Bavio-Ai-v1",
    fullName: "ravitejabolla756-sys/Bavio-Ai-v1",
    totalFiles: 390,
    status: "healthy",
    usagesCount: 27,
    providers: ["Twilio", "OpenAI", "Supabase", "Groq", "Deepgram", "ElevenLabs"],
  };

  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-5 space-y-5 font-mono text-xs">
      {/* Header & Repo Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Compatibility Intelligence Graph
          </h3>
          <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
            Real-time mapping of repository AST symbol invocations to vendor change intelligence
          </p>
        </div>

        <div className="flex items-center gap-2">
          {demoData.repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => setSelectedRepo(repo.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-2 border ${
                selectedRepo === repo.id
                  ? "bg-zinc-900 text-zinc-100 border-zinc-700 shadow-sm"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
              {repo.name}
              {repo.status === "healthy" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dependency Network Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/80">
        {/* Repo Node */}
        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
            Connected Repository
          </div>
          <div className="space-y-1">
            <Link
              href={`/dashboard/repositories/${currentRepo.id}`}
              className="text-sm font-bold text-emerald-400 hover:underline flex items-center gap-1.5"
            >
              {currentRepo.name}
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
            <div className="text-[11px] text-zinc-400 font-sans">{currentRepo.fullName}</div>
          </div>

          <div className="pt-2 border-t border-zinc-900 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Source Files:</span>
              <span className="text-zinc-200 font-semibold">{currentRepo.totalFiles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Scan Status:</span>
              <StatusPill
                status={currentRepo.status === "healthy" ? "healthy" : "pr_created"}
                label={currentRepo.status === "healthy" ? "Healthy / 0 Risks" : "Draft PR Created"}
              />
            </div>
          </div>
        </div>

        {/* Center Connection Graph */}
        <div className="md:col-span-2 p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="flex justify-between items-center text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
            <span>Detected Integration Graph ({currentRepo.providers.length} SDKs)</span>
            <span className="text-emerald-400">AST Symbol Mapped</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {currentRepo.providers.map((provider) => {
              const isReviewed = provider === "Stripe" || provider === "Twilio";
              const isAffected = currentRepo.id === "apiproof-github-fixture" && provider === "Stripe";

              return (
                <div
                  key={provider}
                  className={`p-2.5 rounded border space-y-1 transition-all ${
                    isAffected
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : isReviewed
                      ? "bg-teal-500/10 border-teal-500/30 text-teal-300"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{provider}</span>
                    {isAffected ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    ) : isReviewed ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>
                  <div className="text-[10px] font-sans flex justify-between items-center text-zinc-500">
                    <span>{isReviewed ? "Reviewed Rules" : "Detected"}</span>
                    {provider === "Twilio" && <span className="font-mono text-emerald-400 font-bold">27 usages</span>}
                    {provider === "Stripe" && <span className="font-mono text-amber-400 font-bold">1 usage</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
