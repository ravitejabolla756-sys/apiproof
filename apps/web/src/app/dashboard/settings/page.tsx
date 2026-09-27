"use client";

import { useEffect, useState } from "react";
import { Sliders, Github, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GitHubInstallationInfo {
  id: string;
  accountLogin: string;
  accountType: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [installation, setInstallation] = useState<GitHubInstallationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch('/api/github/repositories');
        if (res.ok) {
          const data = await res.json();
          if (data.connected && data.installation) {
            setInstallation(data.installation);
          } else {
            setInstallation(null);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load GitHub installation status:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  async function handleConnectGitHub() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/github/install');
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to generate installation URL");
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate GitHub connection.");
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <Sliders className="w-6 h-6 text-purple-700" />
          Workspace Settings
        </h1>
        <p className="text-xs text-[#686868]">
          Configure analysis preferences, security policies, and GitHub App integrations.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* SECURITY & GITHUB APP SETTINGS */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                <Github className="w-4 h-4 text-[#111111]" />
                GitHub App Connection
              </h3>
              {installation && (
                <span className="px-2.5 py-1 rounded-full bg-[#EEF7F2] text-emerald-800 border border-[#D1EBE0] text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  GitHub connected
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-6 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-center gap-2 text-[#686868]">
                <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
                <span>Checking GitHub installation status...</span>
              </div>
            ) : installation ? (
              <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-[#111111] flex items-center gap-1.5">
                    <span>{installation.accountLogin}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-zinc-200 text-zinc-700">
                      {installation.accountType}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#686868]">Authorized for read-only AST scans & draft PR creation</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGitHub}
                  disabled={connecting}
                  className="font-medium text-xs gap-1.5"
                >
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  <span>Adjust Repositories</span>
                </Button>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-[#111111]">Not connected to GitHub</div>
                  <div className="text-[11px] text-[#686868]">
                    Install the APIProof GitHub App to grant access to your repositories.
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConnectGitHub}
                  disabled={connecting}
                  className="font-medium text-xs gap-1.5 shrink-0"
                >
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                  <span>Connect GitHub</span>
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-[#E8E8E5] space-y-4">
              <h4 className="font-semibold text-xs text-[#111111]">Safety Policies</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E8E5]">
                  <div>
                    <div className="font-medium text-xs text-[#111111]">Read-only scanning mode</div>
                    <div className="text-[11px] text-[#686868]">APIProof never writes directly to monitored default branches</div>
                  </div>
                  <input type="checkbox" checked disabled className="rounded text-[#111111]" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E8E5]">
                  <div>
                    <div className="font-medium text-xs text-[#111111]">Draft PRs only</div>
                    <div className="text-[11px] text-[#686868]">Pull requests are created as drafts requiring human review</div>
                  </div>
                  <input type="checkbox" checked disabled className="rounded text-[#111111]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE INFO */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111]">Workspace Profile</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Workspace:</span>
                <span className="font-semibold text-[#111111]">Active Workspace</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Plan:</span>
                <span className="font-semibold text-emerald-700">Developer Preview</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#686868]">AST Engine Version:</span>
                <span className="font-mono text-[#111111]">v2.4.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
