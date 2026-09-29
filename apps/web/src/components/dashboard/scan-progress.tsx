"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScanProgress() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  const steps = [
    "Reading repository main branch...",
    "Indexing package dependencies & lockfiles...",
    "Resolving AST SDK bindings (Twilio, Stripe, OpenAI)...",
    "Matching against 11 reviewed API change rules...",
    "Tracing 27 Twilio usages in Bavio-Ai-v1...",
    "Scan Complete: 0 matching breaking changes (NOT_AFFECTED)",
  ];

  const handleStartScan = () => {
    setIsScanning(true);
    setScanStep(0);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      if (current < steps.length) {
        setScanStep(current);
      } else {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 800);
  };

  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-zinc-100">MY OWL Scan Simulator</span>
          <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800">
            AST Engine v1.0
          </span>
        </div>

        <Button
          size="sm"
          onClick={handleStartScan}
          disabled={isScanning}
          className="h-8 text-xs font-mono gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-emerald-400" : ""}`} />
          {isScanning ? "Scanning..." : "Run Engine Scan"}
        </Button>
      </div>

      {/* Progress Box */}
      <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>Engine Progress</span>
          <span className="text-emerald-400 font-semibold">
            {Math.round(((scanStep + 1) / steps.length) * 100)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${((scanStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step Log */}
        <div className="flex items-center gap-2 text-xs pt-1">
          {isScanning ? (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="text-zinc-200">{steps[scanStep]}</span>
        </div>
      </div>
    </div>
  );
}
