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
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-5 font-sans text-xs">
      {/* Header & Repo Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Compatibility map
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Vendor API integration graph and reviewed intelligence coverage
          </p>
        </div>

        <div className="flex items-center gap-2">
          {demoData.repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => setSelectedRepo(repo.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 border ${
                selectedRepo === repo.id
                  ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-mono text-[11px]">{repo.name}</span>
              {repo.status === "healthy" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dependency Network Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80">
        {/* Repo Node */}
        <div className="p-4 rounded bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="text-xs font-semibold text-zinc-400">
            Selected Repository
          </div>
          <div className="space-y-1">
            <Link
              href={`/dashboard/repositories/${currentRepo.id}`}
              className="text-sm font-semibold font-mono text-zinc-100 hover:text-blue-400 flex items-center gap-1.5"
            >
              {currentRepo.name}
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
            <div className="text-[11px] text-zinc-500 font-mono">{currentRepo.fullName}</div>
          </div>

          <div className="pt-2 border-t border-zinc-800/60 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Source files:</span>
              <span className="text-zinc-200 font-mono">{currentRepo.totalFiles}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Status:</span>
              <StatusPill
                status={currentRepo.status === "healthy" ? "healthy" : "affected"}
                label={currentRepo.status === "healthy" ? "Healthy" : "Draft PR Created"}
              />
            </div>
          </div>
        </div>

        {/* Center Connection Graph */}
        <div className="md:col-span-2 p-4 rounded bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
            <span>Detected integrations ({currentRepo.providers.length} SDKs)</span>
            <span className="text-blue-400 font-normal text-[11px]">Symbol mapped</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {currentRepo.providers.map((provider) => {
              const isReviewed = provider === "Stripe" || provider === "Twilio";
              const isAffected = currentRepo.id === "apiproof-github-fixture" && provider === "Stripe";

              return (
                <div
                  key={provider}
                  className={`p-2.5 rounded border space-y-1 transition-colors ${
                    isAffected
                      ? "bg-rose-950/30 border-rose-800/50 text-rose-300"
                      : isReviewed
                      ? "bg-blue-950/30 border-blue-800/40 text-blue-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-200">{provider}</span>
                    {isAffected ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    ) : isReviewed ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>
                  <div className="text-[11px] flex justify-between items-center text-zinc-500">
                    <span>{isReviewed ? "Reviewed" : "Detected"}</span>
                    {provider === "Twilio" && <span className="font-mono text-blue-300">27 usages</span>}
                    {provider === "Stripe" && <span className="font-mono text-amber-300">1 usage</span>}
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
