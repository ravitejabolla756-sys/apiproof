import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  Bell,
  ShieldCheck,
  Lock,
  Building2,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 font-mono">
          Settings & Integrations
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage workspace permissions, GitHub App access, and security policies
        </p>
      </div>

      <div className="space-y-6">
        {/* GitHub Integration */}
        <Card id="github">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-zinc-800 text-zinc-100 border border-zinc-700">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-medium font-mono text-zinc-100">
                  GitHub App Integration
                </CardTitle>
                <p className="text-xs text-zinc-400">
                  Connected as <span className="font-mono text-zinc-200">ravitejabolla756-sys</span>
                </p>
              </div>
            </div>

            <Badge variant="success" className="h-7 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              App Connected (Scoped)
            </Badge>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded bg-zinc-950 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 block">Repository Access</span>
                <span className="font-mono text-zinc-200 text-sm font-semibold">2 Selected Repositories</span>
                <p className="text-zinc-400 text-[11px]">Bavio-Ai-v1, apiproof-github-fixture</p>
              </div>

              <div className="p-3.5 rounded bg-zinc-950 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 block">Code Read Access</span>
                <span className="font-mono text-emerald-400 text-sm font-semibold">Read-Only Analysis</span>
                <p className="text-zinc-400 text-[11px]">Scans dependencies & AST usages</p>
              </div>

              <div className="p-3.5 rounded bg-zinc-950 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 block">Write Access</span>
                <span className="font-mono text-amber-400 text-sm font-semibold">Draft PRs Only</span>
                <p className="text-zinc-400 text-[11px]">Creates isolated migration branches</p>
              </div>
            </div>

            {/* Safety policy notice */}
            <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-mono text-sm mb-1">Human-Review-Only Policy Enforced</strong>
                APIProof never automatically merges generated pull requests. Every migration requires explicit approval and review by your engineering team.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card id="notifications">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-zinc-800 text-zinc-100 border border-zinc-700">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-medium font-mono text-zinc-100">
                  Notification Channels
                </CardTitle>
                <p className="text-xs text-zinc-400">
                  Configure where breaking change alerts and migration drafts are dispatched
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded bg-zinc-950 border border-zinc-800">
              <div>
                <div className="font-semibold text-zinc-200">In-Dashboard Alerts</div>
                <div className="text-zinc-400 text-[11px]">Real-time notification bell and findings summary</div>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded bg-zinc-950 border border-zinc-800 opacity-60">
              <div>
                <div className="font-semibold text-zinc-200">Email Alerts</div>
                <div className="text-zinc-400 text-[11px]">Send weekly breaking change reports to team members</div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">Placeholder</Badge>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded bg-zinc-950 border border-zinc-800 opacity-60">
              <div>
                <div className="font-semibold text-zinc-200">Slack Webhook</div>
                <div className="text-zinc-400 text-[11px]">Dispatch finding events directly to #dev-infra</div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">Placeholder</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security & Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card id="security">
            <CardHeader>
              <CardTitle className="text-sm font-medium font-mono text-zinc-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Security & Isolation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block font-mono">Zero Code Storage</span>
                <p className="text-zinc-400 text-[11px]">Source code is analyzed ephemerally during scans and never saved to persistent storage.</p>
              </div>
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block font-mono">Deterministic Branching</span>
                <p className="text-zinc-400 text-[11px]">All generated branches use SHA-256 patch digests for idempotent executions.</p>
              </div>
            </CardContent>
          </Card>

          <Card id="workspace">
            <CardHeader>
              <CardTitle className="text-sm font-medium font-mono text-zinc-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Workspace Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400">Workspace Name:</span>
                <span className="font-mono text-zinc-200">Acme Dev Organization</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400">Plan:</span>
                <span className="font-mono text-emerald-400">Developer Tier (Local Demo)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400">Connected Repos:</span>
                <span className="font-mono text-zinc-200">2 / Unlimited</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
