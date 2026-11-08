"use client";

import { useEffect, useState } from "react";
import { Sliders, Github, CheckCircle2, AlertCircle, Loader2, ExternalLink, CreditCard, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackConnectionCard } from "@/components/dashboard/slack-connection-card";
import Link from "next/link";

interface GitHubInstallationInfo {
  id: string;
  accountLogin: string;
  accountType: string;
}

interface BillingSummary {
  subscription: {
    planId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  plan: {
    id: string;
    name: string;
    description: string;
    priceMonthly: number | null;
    limits: {
      maxRepositories: number | null;
      maxScansPerMonth: number | null;
      maxDraftPrsPerMonth: number | null;
    };
  };
  metrics: {
    repositories: { current: number; limit: number | null; allowed: boolean };
    scans: { current: number; limit: number | null; allowed: boolean };
    draftPrs: { current: number; limit: number | null; allowed: boolean };
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [installation, setInstallation] = useState<GitHubInstallationInfo | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'load' | 'connect' | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    setErrorAction(null);
    try {
      const [repoRes, billingRes] = await Promise.all([
        fetch('/api/github/repositories'),
        fetch('/api/billing/subscription'),
      ]);

      if (!repoRes.ok || !billingRes.ok) throw new Error('Workspace settings data is temporarily unavailable.');

      if (repoRes.ok) {
        const repoData = await repoRes.json();
        if (repoData.connected && repoData.installation) {
          setInstallation(repoData.installation);
        } else {
          setInstallation(null);
        }
      }

      if (billingRes.ok) {
        const billingData = await billingRes.json();
        setBilling(billingData);
      }
    } catch (err: unknown) {
      console.error("Failed to load settings data:", err);
      setError(err instanceof Error ? err.message : 'Workspace settings data is temporarily unavailable.');
      setErrorAction('load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleConnectGitHub() {
    setConnecting(true);
    setError(null);
    setErrorAction(null);
    try {
      const res = await fetch('/api/github/install');
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to generate installation URL");
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate GitHub connection.");
      setErrorAction('connect');
      setConnecting(false);
    }
  }

  return (
    <div aria-busy={loading ? 'true' : undefined} className="space-y-6 max-w-[1440px] font-sans text-xs">
      {/* HEADER */}
      <div className="border-b border-[#E8E8E5] pb-6 space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-[#111111] flex items-center gap-2">
          <Sliders aria-hidden="true" className="w-6 h-6 text-purple-700" />
          Workspace Settings & Billing
        </h1>
        <p className="text-xs text-[#686868]">
          Manage workspace subscriptions, usage quotas, safety policies, and GitHub App integrations.
        </p>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" aria-atomic="true" className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex flex-wrap items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void (errorAction === 'connect' ? handleConnectGitHub() : loadStatus())} className="border-rose-300 text-rose-900 hover:bg-rose-100">{errorAction === 'connect' ? 'Retry GitHub connection' : 'Retry settings load'}</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT 65%: GITHUB APP & BILLING QUOTAS */}
        <div className="lg:col-span-8 space-y-6">

          <div className="rounded-2xl border border-[#E8E8E5] bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#111111]">Personal account</h2>
                <p className="mt-1 text-xs text-[#686868]">Update your profile or manage your sign-in credentials.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/settings/account" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#D9D9D4] px-3 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F6F6F4]">Account settings</Link>
                <Link href="/dashboard/settings/workspace" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#D9D9D4] px-3 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F6F6F4]">Workspace administration</Link>
              </div>
            </div>
          </div>

          {/* BILLING & PLAN OVERVIEW */}
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                <CreditCard aria-hidden="true" className="w-4 h-4 text-purple-700" />
                Subscription & Usage Quotas
              </h3>
              {billing && (
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-semibold uppercase tracking-wider">
                  {billing.plan.name} Plan ({billing.subscription.status})
                </span>
              )}
            </div>

            {loading ? (
              <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="p-6 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-center gap-2 text-[#686868]">
                <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-purple-700" />
                <span>Loading workspace billing summary...</span>
              </div>
            ) : billing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* METRIC 1: REPOSITORIES */}
                  <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#686868]">
                      <span>Monitored Repos</span>
                      <span className="font-mono font-semibold text-[#111111]">
                        {billing.metrics.repositories.current} / {billing.metrics.repositories.limit ?? 'Unlimited'}
                      </span>
                    </div>
                    {billing.metrics.repositories.limit !== null && <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className="h-full bg-purple-700 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (billing.metrics.repositories.current / billing.metrics.repositories.limit) * 100)}%`,
                        }}
                      />
                    </div>}
                  </div>

                  {/* METRIC 2: SCANS */}
                  <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#686868]">
                      <span>Scans (Monthly)</span>
                      <span className="font-mono font-semibold text-[#111111]">
                        {billing.metrics.scans.current} / {billing.metrics.scans.limit ?? 'Unlimited'}
                      </span>
                    </div>
                    {billing.metrics.scans.limit !== null && <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (billing.metrics.scans.current / billing.metrics.scans.limit) * 100)}%`,
                        }}
                      />
                    </div>}
                  </div>

                  {/* METRIC 3: REPOSITORY WRITES */}
                  <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#686868]">
                      <span>Repository writes</span>
                      <span className="font-mono font-semibold text-[#111111]">
                        Verified Draft PRs only
                      </span>
                    </div>
                    {billing.metrics.draftPrs.limit !== null && <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (billing.metrics.draftPrs.current / billing.metrics.draftPrs.limit) * 100)}%`,
                        }}
                      />
                    </div>}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[#E8E8E5]">
                  <p className="text-[11px] text-[#686868]">
                    Current billing period resets on{' '}
                    <span className="font-mono font-medium text-[#111111]">
                      {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>.
                  </p>
                  <div className="flex items-center gap-2">
                    {billing.plan.id === 'free' ? (
                      <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800">
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>View paid-plan rollout</span>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="gap-1.5 font-medium"
                      >
                        <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Billing portal unavailable in beta</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                Billing summary is unavailable until workspace settings reload.
              </div>
            ) : null}
          </div>

          {/* GITHUB APP SETTINGS */}
          <SlackConnectionCard />
          <div className="rounded-[28px] bg-white border border-[#E8E8E5] p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                <Github aria-hidden="true" className="w-4 h-4 text-[#111111]" />
                GitHub App Integration
              </h3>
              {installation && (
                <span className="px-2.5 py-1 rounded-full bg-[#EEF7F2] text-emerald-800 border border-[#D1EBE0] text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 aria-hidden="true" className="w-3 h-3 text-emerald-600" />
                  GitHub connected
                </span>
              )}
            </div>

            {loading ? (
              <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="p-6 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-center gap-2 text-[#686868]">
                <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-purple-700" />
                <span>Checking GitHub installation status...</span>
              </div>
            ) : installation ? (
              <div role="status" aria-live="polite" aria-atomic="true" className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-[#111111] flex items-center gap-1.5">
                    <span>{installation.accountLogin}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-zinc-200 text-zinc-700">
                      {installation.accountType}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#686868]">Authorized for read-only repository scans; no repository writes in beta</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGitHub}
                  disabled={connecting}
                  className="font-medium text-xs gap-1.5"
                >
                  {connecting ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />}
                  <span>Adjust Repositories</span>
                </Button>
              </div>
            ) : error ? (
              <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                GitHub connection status is unavailable until workspace settings reload.
              </div>
            ) : (
              <div role="status" aria-live="polite" aria-atomic="true" className="p-5 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-[#111111]">Not connected to GitHub</div>
                  <div className="text-[11px] text-[#686868]">
                    Install the MY OWL GitHub App to grant access to your repositories.
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConnectGitHub}
                  disabled={connecting}
                  className="font-medium text-xs gap-1.5 shrink-0"
                >
                  {connecting ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : <Github aria-hidden="true" className="w-3.5 h-3.5" />}
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
                    <div className="text-[11px] text-[#686868]">MY OWL never writes directly to monitored default branches</div>
                  </div>
                  <Check aria-hidden="true" className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E8E5]">
                  <div>
                    <div className="font-medium text-xs text-[#111111]">No automatic repository writes</div>
                    <div className="text-[11px] text-[#686868]">Findings stop at evidence for human review during beta</div>
                  </div>
                  <Check aria-hidden="true" className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE PROFILE */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-semibold text-[#111111]">Workspace Profile</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Workspace:</span>
                <span className="font-semibold text-[#111111]">Active Workspace</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Subscription:</span>
                <span className="font-semibold text-emerald-700 capitalize">
                  {billing?.subscription.status || 'Active'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E8E8E5]">
                <span className="text-[#686868]">Provider Boundary:</span>
                <span className="font-mono text-[#111111]">Mock / Stripe (Configurable)</span>
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
