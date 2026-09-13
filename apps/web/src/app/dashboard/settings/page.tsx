"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { Github, ShieldCheck, Bell } from "lucide-react";

export default function TabbedSettingsPage() {
  const [activeTab, setActiveTab] = useState<"github" | "repositories" | "notifications" | "security">("github");

  return (
    <div className="space-y-6 max-w-4xl font-sans text-xs">
      {/* Header Bar */}
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage GitHub App connection, repository access, notifications, and security policies.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-zinc-800/80 pb-3">
        {(["github", "repositories", "notifications", "security"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md font-medium text-xs capitalize transition-colors ${
              activeTab === tab
                ? "bg-zinc-900 text-zinc-100 border border-zinc-700"
                : "text-zinc-400 border border-transparent hover:text-zinc-200"
            }`}
          >
            {tab === "github" ? "GitHub" : tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENTS */}
      {activeTab === "github" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200">
                  <Github className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">GitHub App connection</h2>
                  <p className="text-xs text-zinc-400 font-mono">Connected: ravitejabolla756-sys</p>
                </div>
              </div>
              <StatusPill status="healthy" label="Connected" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px] block">Metadata</span>
                <span className="font-mono text-zinc-200 font-medium">Read-only</span>
              </div>
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">Contents</span>
                <span className="font-mono text-zinc-200 font-medium block">Read / Write (Approved)</span>
              </div>
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">Pull requests</span>
                <span className="font-mono text-zinc-200 font-medium block">Read / Write (Draft PRs)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "repositories" && (
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">Monitored repositories</h2>
          <div className="space-y-2 text-xs font-mono text-zinc-300">
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <span>Bavio-Ai-v1</span>
              <span className="text-zinc-500 text-[11px]">main branch</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <span>apiproof-github-fixture</span>
              <span className="text-zinc-500 text-[11px]">main branch</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Security policies</h2>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="font-semibold text-zinc-200 block">Read-only analysis by default</span>
              <p className="text-zinc-400 leading-relaxed">
                Repository code scanning evaluates AST symbols ephemerally without persistent server storage.
              </p>
            </div>
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="font-semibold text-zinc-200 block">Human review mandatory</span>
              <p className="text-zinc-400 leading-relaxed">
                Automated merging is disabled. Migrations are created as review-only Draft PRs.
              </p>
            </div>
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="font-semibold text-zinc-200 block">No direct main branch writes</span>
              <p className="text-zinc-400 leading-relaxed">
                All changes are isolated on dedicated feature branches (<code className="font-mono text-zinc-300">apiproof/*</code>).
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Notification channels</h2>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <div>
                <span className="font-medium text-zinc-200 block">In-dashboard alerts</span>
                <span className="text-zinc-500 text-[11px]">Console notifications for affected API changes</span>
              </div>
              <StatusPill status="healthy" label="Enabled" />
            </div>
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/60 flex justify-between items-center opacity-60">
              <div>
                <span className="font-medium text-zinc-400 block">Email summaries (Future)</span>
                <span className="text-zinc-500 text-[11px]">Weekly API compatibility Digest</span>
              </div>
              <span className="text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">Disabled</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
