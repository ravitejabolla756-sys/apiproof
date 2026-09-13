"use client";

import { useState, useEffect } from "react";
import {
  Terminal,
  ShieldCheck,
  GitBranch,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  GitPullRequest,
  Layers,
  Zap,
} from "lucide-react";

export function HeroScanViz() {
  const [activeTab, setActiveTab] = useState<"bavio" | "stripe">("bavio");
  const [step, setStep] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/90 shadow-2xl shadow-emerald-500/5 overflow-hidden backdrop-blur-sm font-mono text-xs">
      {/* Top Window Bar */}
      <div className="bg-zinc-900/90 px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="text-[11px] text-zinc-400 font-semibold ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            apiproof-engine-daemon v1.0
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80 text-[10px]">
          <button
            onClick={() => {
              setActiveTab("bavio");
              setStep(0);
            }}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "bavio"
                ? "bg-zinc-800 text-emerald-400 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Bavio Real Repo
          </button>
          <button
            onClick={() => {
              setActiveTab("stripe");
              setStep(0);
            }}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "stripe"
                ? "bg-zinc-800 text-amber-400 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Stripe Deprecation
          </button>
        </div>
      </div>

      {/* Interactive Canvas Content */}
      <div className="p-5 space-y-5 bg-gradient-to-b from-zinc-950 to-zinc-900/40">
        {activeTab === "bavio" ? (
          <>
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-zinc-100">ravitejabolla756-sys/Bavio-Ai-v1</span>
                <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800">
                  main (390 files)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                Live Tracing
              </div>
            </div>

            {/* Tracing Pipeline Flow */}
            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
              <div
                className={`p-2.5 rounded border transition-all ${
                  step >= 0
                    ? "bg-zinc-900 border-emerald-500/40 text-emerald-300"
                    : "bg-zinc-950 border-zinc-800/60 text-zinc-500"
                }`}
              >
                <div className="font-bold mb-1 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3 text-teal-400" /> 1. Vendor Event
                </div>
                <div>Twilio SDK v5.12+</div>
              </div>

              <div
                className={`p-2.5 rounded border transition-all ${
                  step >= 1
                    ? "bg-zinc-900 border-emerald-500/40 text-emerald-300"
                    : "bg-zinc-950 border-zinc-800/60 text-zinc-500"
                }`}
              >
                <div className="font-bold mb-1 flex items-center justify-center gap-1">
                  <Layers className="w-3 h-3 text-sky-400" /> 2. SDK Symbols
                </div>
                <div>27 Twilio Usages</div>
              </div>

              <div
                className={`p-2.5 rounded border transition-all ${
                  step >= 2
                    ? "bg-zinc-900 border-emerald-500/40 text-emerald-300"
                    : "bg-zinc-950 border-zinc-800/60 text-zinc-500"
                }`}
              >
                <div className="font-bold mb-1 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> 3. AST Tracing
                </div>
                <div>10 Backend Files</div>
              </div>

              <div
                className={`p-2.5 rounded border transition-all ${
                  step >= 3
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "bg-zinc-950 border-zinc-800/60 text-zinc-500"
                }`}
              >
                <div className="font-bold mb-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 4. Result
                </div>
                <div className="font-extrabold text-emerald-400">NOT_AFFECTED</div>
              </div>
            </div>

            {/* Trace Evidence Snippet */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 text-[11px] space-y-1.5">
              <div className="flex justify-between text-zinc-400 border-b border-zinc-900 pb-1 text-[10px]">
                <span>Indexed AST Usage Locations</span>
                <span className="text-emerald-400 font-bold">0 Affected Breaking Changes</span>
              </div>
              <div className="text-zinc-400 space-y-1 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>backend/providers/twilio.js</span>
                  <span className="text-zinc-500 text-[10px] ml-auto">calls.create()</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>backend/services/twilioPhoneNumberService.js</span>
                  <span className="text-zinc-500 text-[10px] ml-auto">incomingPhoneNumbers</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>backend/voice/providers/current/CurrentTwilioTelephony.js</span>
                  <span className="text-zinc-500 text-[10px] ml-auto">twiml.VoiceResponse</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-zinc-100">ravitejabolla756-sys/apiproof-github-fixture</span>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                  Stripe Coupon Removal
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                1 Affected Usage
              </div>
            </div>

            {/* Code Diff Preview */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-2 text-[11px]">
              <div className="flex justify-between text-zinc-400 text-[10px] border-b border-zinc-900 pb-1">
                <span>src/billing.ts</span>
                <span className="text-emerald-400">AST Transformation Verified</span>
              </div>
              <div className="space-y-1 leading-relaxed">
                <div className="text-zinc-500">return stripe.subscriptions.create(&#123;</div>
                <div className="text-zinc-400">  customer: customerId,</div>
                <div className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border-l-2 border-rose-500">
                  - coupon: couponId
                </div>
                <div className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border-l-2 border-emerald-500">
                  + discounts: [&#123; coupon: couponId &#125;]
                </div>
                <div className="text-zinc-500">&#125;);</div>
              </div>
            </div>

            {/* Verification & PR status */}
            <div className="flex items-center justify-between p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-[11px]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-zinc-200">Verification Gate: 4/4 PASSED</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px]">
                <GitPullRequest className="w-3 h-3" />
                Draft PR #1
              </span>
            </div>
          </>
        )}

        {/* Footer info strip */}
        <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/60">
          <span>Engine Status: Healthy / Read-Only</span>
          <span className="text-zinc-400 flex items-center gap-1">
            Human Review Required <ArrowRight className="w-3 h-3 text-emerald-400" />
          </span>
        </div>
      </div>
    </div>
  );
}
