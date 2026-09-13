"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { ChevronLeft } from "lucide-react";

export default function BavioRepoDetailPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "usages" | "changes" | "history">("overview");

  const bavioUsages = [
    { provider: "Twilio", symbol: "calls.create()", file: "backend/providers/twilio.js", type: "Telephony Outbound Call", coverage: "Reviewed" },
    { provider: "Twilio", symbol: "availablePhoneNumbers.list()", file: "backend/services/twilioPhoneNumberService.js", type: "Phone Inventory Query", coverage: "Reviewed" },
    { provider: "Twilio", symbol: "mediaStreams.connect()", file: "backend/routes/callStream.js", type: "WebSocket Voice Stream", coverage: "Reviewed" },
    { provider: "Twilio", symbol: "twiml.VoiceResponse()", file: "backend/voice/providers/current/CurrentTwilioTelephony.js", type: "TwiML Markup Generator", coverage: "Reviewed" },
    { provider: "OpenAI", symbol: "chat.completions.create()", file: "backend/services/aiService.js", type: "Inference Stream", coverage: "Detected" },
    { provider: "Supabase", symbol: "from('users').select()", file: "backend/db/supabaseClient.js", type: "Database Query", coverage: "Detected" },
  ];

  return (
    <div className="space-y-6 max-w-7xl font-sans text-xs">
      {/* Back & Breadcrumb */}
      <div>
        <Link
          href="/dashboard/repositories"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-4 font-medium"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to repositories
        </Link>

        <div className="p-6 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="font-bold text-2xl text-zinc-100 font-mono">Bavio-Ai-v1</h1>
                <StatusPill status="healthy" label="Healthy" />
              </div>
              <p className="text-zinc-400 text-xs font-mono">
                ravitejabolla756-sys/Bavio-Ai-v1 · Default branch: main (934b582)
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                Source files: <strong className="text-zinc-100">390</strong>
              </div>
              <div className="px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                Usages indexed: <strong className="text-blue-400">27</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-zinc-800/80 pb-3">
        {(["overview", "usages", "changes", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md font-medium text-xs capitalize transition-colors ${
              activeTab === tab
                ? "bg-zinc-900 text-zinc-100 border border-zinc-700"
                : "text-zinc-400 border border-transparent hover:text-zinc-200"
            }`}
          >
            {tab === "usages" ? "API Usages" : tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 p-5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-100">Repository analysis overview</h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              APIProof analyzed 390 source files read-only in <code className="font-mono text-zinc-100">Bavio-Ai-v1</code>, identified 27 Twilio SDK call locations across telephony and routes, matched them against 11 active reviewed breaking change rules, and confirmed zero current impact.
            </p>

            <div className="bg-zinc-950 p-4 rounded border border-zinc-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Classification:</span>
                <span className="font-semibold text-emerald-400">NOT_AFFECTED</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Twilio SDK version:</span>
                <span className="text-zinc-200">^5.12.2</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Matching breaking changes:</span>
                <span className="text-zinc-200">0 matching rules</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 p-5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-100">Detected integrations (9)</h2>
            <div className="space-y-1.5">
              {["Twilio", "OpenAI", "Supabase", "Groq", "Dodo Payments", "Deepgram", "ElevenLabs", "Sarvam", "Redis"].map((provider) => (
                <div
                  key={provider}
                  className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800/60 text-xs"
                >
                  <span className="font-medium text-zinc-200">{provider}</span>
                  {provider === "Twilio" ? (
                    <span className="text-blue-400 font-mono">27 usages</span>
                  ) : (
                    <span className="text-zinc-500">Detected</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "usages" && (
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800/80 text-zinc-400 text-[11px] font-medium">
                  <th className="py-2.5 px-4 font-medium">Provider</th>
                  <th className="py-2.5 px-4 font-medium">Symbol</th>
                  <th className="py-2.5 px-4 font-medium">Source File</th>
                  <th className="py-2.5 px-4 font-medium">Usage type</th>
                  <th className="py-2.5 px-4 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {bavioUsages.map((usage, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-zinc-100">{usage.provider}</td>
                    <td className="py-3 px-4 font-mono text-blue-300 text-[11px]">{usage.symbol}</td>
                    <td className="py-3 px-4 font-mono text-zinc-300 text-[11px]">{usage.file}</td>
                    <td className="py-3 px-4 text-zinc-400">{usage.type}</td>
                    <td className="py-3 px-4">
                      <StatusPill
                        status={usage.coverage === "Reviewed" ? "reviewed" : "detected"}
                        label={usage.coverage}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "changes" && (
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">Reviewed change rules matching</h2>
          <div className="p-4 rounded bg-zinc-950 border border-zinc-800 text-xs space-y-1">
            <span className="font-semibold text-emerald-400 block">Classification: NOT_AFFECTED</span>
            <p className="text-zinc-400 leading-relaxed">
              APIProof detected 27 Twilio SDK calls in Bavio-Ai-v1 and verified that zero calls match current breaking change rules.
            </p>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">Scan execution log</h2>
          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs font-mono">
            <div>
              <span className="text-zinc-200 font-medium block">Scan #819 - Read-only analysis</span>
              <span className="text-zinc-500 text-[11px]">Completed in 1.4s · 390 source files</span>
            </div>
            <StatusPill status="healthy" label="NOT_AFFECTED" />
          </div>
        </div>
      )}
    </div>
  );
}
