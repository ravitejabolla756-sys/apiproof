"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Github,
  Lock,
  Building2,
  Sliders,
} from "lucide-react";

export default function TabbedSettingsPage() {
  const [activeTab, setActiveTab] = useState<"github" | "scanning" | "security" | "notifications" | "workspace">("github");

  return (
    <div className="space-y-8 max-w-5xl font-mono text-xs">
      {/* Header Bar */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          Workspace Settings & Integrations
        </h1>
        <p className="text-xs text-zinc-400 font-sans mt-1">
          Manage GitHub App installation permissions, scanning behavior, and security policies
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        {(["github", "scanning", "security", "notifications", "workspace"] as const).map((tab) => (
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

      {/* TAB CONTENTS */}
      {activeTab === "github" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-zinc-900 text-zinc-100 border border-zinc-800">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-zinc-100">
                  GitHub App Connection
                </CardTitle>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Connected to account <code className="text-zinc-200">ravitejabolla756-sys</code>
                </p>
              </div>
            </div>
            <StatusPill status="verified" label="App Connected (Scoped)" />
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">Repository Access</span>
                <span className="font-bold text-zinc-200 text-sm">2 Repositories</span>
                <p className="text-zinc-400 text-[11px] font-sans">Bavio-Ai-v1, apiproof-github-fixture</p>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">Read Permissions</span>
                <span className="font-bold text-emerald-400 text-sm">Contents: Read</span>
                <p className="text-zinc-400 text-[11px] font-sans">Scans dependencies & AST symbol calls</p>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 block text-[10px]">Write Permissions</span>
                <span className="font-bold text-cyan-300 text-sm">Pull Requests: Write</span>
                <p className="text-zinc-400 text-[11px] font-sans">Creates isolated draft PR branches only</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "scanning" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <CardTitle className="text-sm font-bold text-zinc-100">
              AST Scan Configurations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-zinc-200 block">Automatic Push Trigger</span>
                <span className="text-zinc-400 text-[11px] font-sans">Trigger AST scan when default branch is updated</span>
              </div>
              <StatusPill status="healthy" label="Active" />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "security" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Security Policy Guarantees
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-1">
              <strong className="block text-sm font-bold">1. Human Review Mandatory</strong>
              <p className="text-zinc-300 text-[11px] font-sans">
                APIProof strictly disables automatic branch merging or direct write operations to default branches.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-1">
              <strong className="block text-zinc-200">2. Ephemeral Code Analysis</strong>
              <p className="text-zinc-400 text-[11px] font-sans">
                Repository source files are evaluated in-memory during AST tracing and never stored on persistent disks.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <CardTitle className="text-sm font-bold text-zinc-100">
              Notification Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-zinc-200 block">In-Dashboard Console Alerts</span>
                <span className="text-zinc-400 text-[11px] font-sans">Real-time breaking change notifications</span>
              </div>
              <StatusPill status="healthy" label="Enabled" />
            </div>
            <div className="p-3.5 rounded-lg bg-zinc-900/30 border border-zinc-800/60 flex justify-between items-center opacity-60">
              <div>
                <span className="font-bold text-zinc-400 block">Email Reports</span>
                <span className="text-zinc-500 text-[11px] font-sans">Weekly compatibility summary email</span>
              </div>
              <StatusPill status="neutral" label="Placeholder" />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "workspace" && (
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              Workspace Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Workspace Name:</span>
              <span className="text-zinc-100 font-bold">Acme Engineering Org</span>
            </div>
            <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Subscription Tier:</span>
              <span className="text-emerald-400 font-bold">Developer Plan (Local Demo)</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
