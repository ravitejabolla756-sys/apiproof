"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ShieldCheck,
  CheckCircle2,
  Code2,
} from "lucide-react";

export default function BavioRepoDetailPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "usages" | "changes" | "history">("overview");

  const bavioUsages = [
    { provider: "Twilio", symbol: "calls.create()", file: "backend/providers/twilio.js", type: "Telephony Outbound Call", coverage: "Reviewed Rule 1.1" },
    { provider: "Twilio", symbol: "availablePhoneNumbers.list()", file: "backend/services/twilioPhoneNumberService.js", type: "Phone Inventory Query", coverage: "Reviewed Rule 1.1" },
    { provider: "Twilio", symbol: "mediaStreams.connect()", file: "backend/routes/callStream.js", type: "WebSocket Voice Stream", coverage: "Reviewed Rule 1.1" },
    { provider: "Twilio", symbol: "twiml.VoiceResponse()", file: "backend/voice/providers/current/CurrentTwilioTelephony.js", type: "TwiML Markup Generator", coverage: "Reviewed Rule 1.1" },
    { provider: "OpenAI", symbol: "chat.completions.create()", file: "backend/services/aiService.js", type: "Inference Stream", coverage: "Detected SDK" },
    { provider: "Supabase", symbol: "from('users').select()", file: "backend/db/supabaseClient.js", type: "Database Query", coverage: "Detected SDK" },
  ];

  return (
    <div className="space-y-8 max-w-7xl font-mono text-xs">
      {/* Back & Breadcrumb */}
      <div>
        <Link
          href="/dashboard/repositories"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Repositories
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 p-6 rounded-xl border border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xl text-zinc-100 font-mono">Bavio-Ai-v1</span>
              <StatusPill status="healthy" label="Healthy / NOT_AFFECTED" />
            </div>
            <p className="text-zinc-400 font-sans text-xs">
              ravitejabolla756-sys/Bavio-Ai-v1 • Default branch: <code className="text-zinc-300">main</code> (934b582)
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              Files: <strong className="text-zinc-100">390</strong>
            </div>
            <div className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              Twilio Usages: <strong className="text-emerald-400">27</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        {(["overview", "usages", "changes", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-bold text-xs uppercase transition-colors border-b-2 -mb-2 ${
              activeTab === tab
                ? "bg-zinc-900 text-emerald-400 border-emerald-400"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-zinc-800 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-zinc-400 font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Repository Scan Intelligence Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-sans text-zinc-300 leading-relaxed">
                APIProof scanned 390 source files read-only in <code className="text-emerald-400">Bavio-Ai-v1</code>, identified 27 Twilio SDK call locations across telephony and routes, matched them against 11 active reviewed breaking change rules, and confirmed zero current impact.
              </p>

              <div className="bg-zinc-900/60 p-4 rounded-lg border border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Repository Classification:</span>
                  <span className="font-bold text-emerald-400">NOT_AFFECTED</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Twilio SDK Version:</span>
                  <span className="font-mono text-zinc-200">^5.12.2</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Matching Breaking Changes:</span>
                  <span className="font-mono text-zinc-200">0 Matching Rules</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-zinc-400 font-mono">
                Detected Integrations (9)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["Twilio", "OpenAI", "Supabase", "Groq", "Dodo Payments", "Deepgram", "ElevenLabs", "Sarvam", "Redis"].map((provider) => (
                <div
                  key={provider}
                  className="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/80 text-[11px]"
                >
                  <span className="font-bold text-zinc-200">{provider}</span>
                  {provider === "Twilio" ? (
                    <span className="text-emerald-400 font-bold">27 usages</span>
                  ) : (
                    <span className="text-zinc-500">Detected</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "usages" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-zinc-400 font-mono flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              Indexed AST API Usages Table (27 Total Locations)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 text-[11px]">
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Invoked Symbol</th>
                    <th className="py-2.5 px-3">Source File</th>
                    <th className="py-2.5 px-3">Usage Type</th>
                    <th className="py-2.5 px-3">Reviewed Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-[11px]">
                  {bavioUsages.map((usage, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/30">
                      <td className="py-2.5 px-3 font-bold text-zinc-200">{usage.provider}</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">{usage.symbol}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{usage.file}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{usage.type}</td>
                      <td className="py-2.5 px-3 text-teal-300">{usage.coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "changes" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-zinc-400 font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Matching Reviewed Change Rules (0 Risks)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-sans text-xs">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
              <strong className="block text-sm font-bold mb-1">Status: NOT_AFFECTED</strong>
              APIProof detected 27 Twilio SDK calls in Bavio-Ai-v1 but verified that none match current active breaking changes.
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "history" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-zinc-400 font-mono">
              Scan Execution Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded bg-zinc-900/40 border border-zinc-800 flex justify-between">
              <div>
                <span className="text-zinc-200 font-bold block">Scan #819 - Read-Only Analysis</span>
                <span className="text-zinc-500 text-[11px]">Completed in 1.4s • 390 source files</span>
              </div>
              <span className="text-emerald-400 font-bold">NOT_AFFECTED</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
