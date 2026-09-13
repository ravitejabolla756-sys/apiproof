"use client";

import { useState } from "react";
import Link from "next/link";
import { DEMO_BAVIO_TWILIO_USAGES } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  CheckCircle2,
  FileCode,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

export default function BavioRepoDetailPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "usages" | "coverage" | "history">("overview");

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">

      {/* BACK BUTTON */}
      <div>
        <Link href="/dashboard/repositories" className="inline-flex items-center gap-1.5 text-xs text-[#686868] hover:text-[#111111] font-medium transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Repositories
        </Link>
      </div>

      {/* HERO BAND */}
      <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-[#111111]">
                Bavio-Ai-v1
              </h1>
              <StatusPill status="healthy" label="Healthy / NOT_AFFECTED" />
            </div>
            <div className="flex items-center gap-4 text-xs text-[#686868] font-mono">
              <span>ravitejabolla756-sys/Bavio-Ai-v1</span>
              <span>·</span>
              <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5 text-purple-700" /> main</span>
              <span>·</span>
              <span>SHA: 934b582</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/ravitejabolla756-sys/Bavio-Ai-v1"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <span>View on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-2 border-b border-[#E8E8E5] pb-2 font-sans font-medium text-xs">
          {(["overview", "usages", "coverage", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl capitalize transition-all ${
                activeTab === tab
                  ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                  : "text-[#686868] hover:text-[#111111]"
              }`}
            >
              {tab === "usages" ? "API usage (27)" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E8E8E5] space-y-1 shadow-2xs">
              <div className="text-[10px] text-[#686868] uppercase font-semibold">Total Files Scanned</div>
              <div className="text-xl font-bold font-mono text-[#111111]">390 source files</div>
              <div className="text-[11px] text-[#686868]">Read-only AST scan complete</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E8E8E5] space-y-1 shadow-2xs">
              <div className="text-[10px] text-[#686868] uppercase font-semibold">Twilio Call Sites</div>
              <div className="text-xl font-bold font-mono text-purple-700">27 usages indexed</div>
              <div className="text-[11px] text-[#686868]">Across 10 backend files</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E8E8E5] space-y-1 shadow-2xs">
              <div className="text-[10px] text-[#686868] uppercase font-semibold">Integrations Detected</div>
              <div className="text-xl font-bold font-mono text-[#111111]">9 SDK providers</div>
              <div className="text-[11px] text-[#686868]">OpenAI, Supabase, Groq, etc.</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E8E8E5] space-y-1 shadow-2xs">
              <div className="text-[10px] text-[#686868] uppercase font-semibold">Matching Findings</div>
              <div className="text-xl font-bold font-mono text-emerald-700">0 breaking findings</div>
              <div className="text-[11px] text-emerald-700 font-medium">Verified NOT_AFFECTED</div>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#EEF7F2] border border-[#D1EBE0] p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Proof of Non-Impact (Zero-Noise Result)
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              APIProof evaluated 11 reviewed breaking change rules across Twilio and Stripe. While Bavio-Ai-v1 heavily utilizes Twilio SDK v5.12.2 across 27 call sites (including WebSocket audio media streams and incoming phone number creation), none of the breaking changes matched the active code structure.
            </p>
          </div>

        </div>
      )}

      {/* TAB CONTENT: USAGES */}
      {(activeTab === "usages" || activeTab === "overview") && (
        <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-700" />
              Indexed Twilio API Call Sites (Sample 5 of 27)
            </h3>
            <span className="text-xs text-[#686868]">Twilio ^5.12.2</span>
          </div>

          <div className="divide-y divide-[#E8E8E5]">
            {DEMO_BAVIO_TWILIO_USAGES.map((u) => (
              <div key={u.id} className="py-4 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold text-[#111111]">{u.file}:{u.line}</span>
                  <span className="text-purple-700 bg-[#F4F0FA] px-2 py-0.5 rounded border border-[#E4D9F5] text-[11px]">{u.symbol}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-200">
                  <pre>{u.codeSnippet}</pre>
                </div>
                <div className="text-[11px] text-[#686868]">Context: {u.context}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
