"use client";

import { useState } from "react";
import { demoData } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Boxes,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";

export default function InventoryPage() {
  const [expandedProvider, setExpandedProvider] = useState<string | null>("twilio");

  const reviewedProviders = demoData.providerRegistry.filter((p) => p.status === "REVIEWED");
  const detectedProviders = demoData.providerRegistry.filter((p) => p.status === "DETECTED");

  return (
    <div className="space-y-8 max-w-7xl font-mono text-xs">
      {/* Header Bar */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono flex items-center gap-2">
          <Boxes className="w-5 h-5 text-emerald-400" />
          API & SDK Inventory Intelligence
        </h1>
        <p className="text-xs text-zinc-400 font-sans mt-1">
          Catalog of detected third-party API dependencies and reviewed change rules coverage
        </p>
      </div>

      {/* SECTION 1: REVIEWED INTELLIGENCE */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-teal-300">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          REVIEWED CHANGE INTELLIGENCE (Active Rules Supported)
        </div>

        <div className="rounded-xl border border-teal-500/30 bg-zinc-950 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-teal-500/10 border-b border-teal-500/20 text-teal-300 font-mono text-[11px]">
                <th className="py-3 px-4 w-10" />
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Monitored Repos</th>
                <th className="py-3 px-4 text-center">Usages</th>
                <th className="py-3 px-4">Rule Intelligence</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 font-mono text-xs">
              {reviewedProviders.map((p) => {
                const isExpanded = expandedProvider === p.id;

                return (
                  <tr key={p.id} className="hover:bg-zinc-900/30">
                    <td colSpan={7} className="p-0">
                      <div className="flex items-center justify-between py-3.5 px-4">
                        <div className="w-10">
                          <button
                            onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-teal-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="w-48 font-bold text-zinc-100 flex items-center gap-2">
                          <span>{p.name}</span>
                          <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded">
                            {p.rulesCount} Rule
                          </span>
                        </div>

                        <div className="w-44 text-zinc-400">{p.category}</div>

                        <div className="w-40 text-zinc-300">
                          {p.name === "Twilio" ? "Bavio-Ai-v1" : "apiproof-github-fixture"}
                        </div>

                        <div className="w-20 text-center font-bold text-emerald-400">
                          {p.usagesCount}
                        </div>

                        <div className="w-48 text-zinc-300">
                          {p.name === "Stripe"
                            ? "v17.0.0 Subscription Coupon Removal"
                            : "Twiml Uppercase Namespace Rule"}
                        </div>

                        <div className="w-32 text-right">
                          <StatusPill status="reviewed" label="REVIEWED" />
                        </div>
                      </div>

                      {/* Expanded Provider Drawer */}
                      {isExpanded && (
                        <div className="bg-zinc-900/60 p-4 border-t border-zinc-800 space-y-3 font-sans text-xs">
                          <div className="font-mono text-xs font-bold text-teal-300 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-teal-400" />
                            Intelligence Detail: {p.name}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block">Monitored In</span>
                              <span className="text-zinc-200 font-bold">
                                {p.name === "Twilio" ? "Bavio-Ai-v1 (27 Usages)" : "apiproof-github-fixture (1 Usage)"}
                              </span>
                            </div>
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block">Active Change Intelligence</span>
                              <span className="text-amber-400 font-bold">
                                {p.name === "Stripe" ? "stripe-subscription-coupon-removed" : "twilio-twiml-namespace-casing"}
                              </span>
                            </div>
                            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                              <span className="text-zinc-500 block">AST Transformation Capability</span>
                              <span className="text-emerald-400 font-bold">Verified AST Transformer Ready</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: DETECTED INTEGRATIONS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-400">
          <Boxes className="w-4 h-4 text-zinc-500" />
          DETECTED SDK INTEGRATIONS (Recognized In Codebase)
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Detected In</th>
                <th className="py-3 px-4">Coverage Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 font-mono text-xs">
              {detectedProviders.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-900/30">
                  <td className="py-3 px-4 font-bold text-zinc-200">{p.name}</td>
                  <td className="py-3 px-4 text-zinc-400">{p.category}</td>
                  <td className="py-3 px-4 text-zinc-300">Bavio-Ai-v1</td>
                  <td className="py-3 px-4">
                    <StatusPill status="detected" label="DETECTED SDK" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
