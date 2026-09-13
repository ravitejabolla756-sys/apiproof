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
    <div className="rounded-2xl border border-[#E8E8E5] bg-[#F6F6F4] p-5 space-y-5 font-sans text-xs">
      {/* Header & Repo Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E8E5] pb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-700" />
            Compatibility Topology Graph
          </h3>
          <p className="text-xs text-[#686868] mt-0.5">
            Vendor API integration graph and reviewed intelligence coverage
          </p>
        </div>

        <div className="flex items-center gap-2">
          {demoData.repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => setSelectedRepo(repo.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 border ${
                selectedRepo === repo.id
                  ? "bg-white text-[#111111] border-[#111111] shadow-2xs font-semibold"
                  : "bg-white text-[#686868] border-[#E8E8E5] hover:text-[#111111]"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-mono text-[11px]">{repo.name}</span>
              {repo.status === "healthy" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dependency Network Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-[#E8E8E5] shadow-xs">
        {/* Repo Node */}
        <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#686868]">
            Selected Repository
          </div>
          <div className="space-y-1">
            <Link
              href={`/dashboard/repositories/${currentRepo.id}`}
              className="text-sm font-semibold font-mono text-[#111111] hover:text-purple-700 flex items-center gap-1.5"
            >
              {currentRepo.name}
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
            </Link>
            <div className="text-[11px] text-[#686868] font-mono">{currentRepo.fullName}</div>
          </div>

          <div className="pt-2 border-t border-[#E8E8E5] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#686868]">Source files:</span>
              <span className="text-[#111111] font-mono">{currentRepo.totalFiles}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#686868]">Status:</span>
              <StatusPill
                status={currentRepo.status === "healthy" ? "healthy" : "affected"}
                label={currentRepo.status === "healthy" ? "Healthy" : "Draft PR Created"}
              />
            </div>
          </div>
        </div>

        {/* Center Connection Graph */}
        <div className="md:col-span-2 p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-[#686868]">
            <span>Detected integrations ({currentRepo.providers.length} SDKs)</span>
            <span className="text-purple-700 font-medium text-[11px]">Symbol mapped</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {currentRepo.providers.map((provider) => {
              const isReviewed = provider === "Stripe" || provider === "Twilio";
              const isAffected = currentRepo.id === "apiproof-github-fixture" && provider === "Stripe";

              return (
                <div
                  key={provider}
                  className={`p-3 rounded-xl border space-y-1 transition-colors ${
                    isAffected
                      ? "bg-[#FDF2F2] border-[#F8D7DA] text-rose-900"
                      : isReviewed
                      ? "bg-[#EBF3FC] border-[#C6E1FA] text-blue-900"
                      : "bg-white border-[#E8E8E5] text-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#111111]">{provider}</span>
                    {isAffected ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    ) : isReviewed ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                  <div className="text-[11px] flex justify-between items-center text-[#686868]">
                    <span>{isReviewed ? "Reviewed" : "Detected"}</span>
                    {provider === "Twilio" && <span className="font-mono text-blue-800 font-medium">27 usages</span>}
                    {provider === "Stripe" && <span className="font-mono text-rose-800 font-medium">1 usage</span>}
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
