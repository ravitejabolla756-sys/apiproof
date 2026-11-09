'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DashboardDataError } from '@/components/dashboard/data-state';
import { toSafeExternalUrl } from '@/lib/external-link-contract';

type ProviderCoverage = {
  providerId: string;
  providerName: string;
  sourceUrl: string;
  sourceType: string;
  discoveryAvailable: boolean;
  candidateCount: number;
  reviewedRuleCount: number;
  scannerCoverage: 'reviewed-rules' | 'no-reviewed-rules';
  autoRescan: boolean;
  autoFix: 'guarded-human-review';
  migrationTemplateStatus: 'deterministic-ast' | 'review-only';
  migrationTemplateLimitation: string;
  migrationTemplateCount: number;
  verifiedMigrationTemplateCount: number;
  reviewOnlyTemplateProposalCount: number;
  candidateCountWithoutTemplateProposal: number;
  migrationTemplatePromotion: {
    candidateIds: string[];
    proposalModes: Array<'transform' | 'manual-guidance'>;
    nextStep: string;
  } | null;
  sourceHealth: {
    status: 'never-run' | 'healthy' | 'due' | 'failing' | 'disabled';
    lastSuccessAt: string | null;
    nextAttemptAt: string | null;
    failureCount: number;
    parserStatus: 'structured' | 'review-only' | 'not-run';
  };
};

type CoverageResponse = {
  summary: {
    configuredSources: number;
    discoveryProviders: number;
    providersWithReviewedRules: number;
    reviewedRules: number;
    providersWithMigrationTemplates: number;
    migrationTemplates: number;
    providersWithVerifiedMigrationTemplates: number;
    verifiedMigrationTemplates: number;
    providersWithReviewOnlyTemplateProposals: number;
    reviewOnlyTemplateProposals: number;
    autoFixPolicy: 'guarded-human-review';
    reviewQueue: { P0: number; P1: number; P2: number };
    migrationTemplatePromotionQueue: Array<{ providerId: string; candidateIds: string[]; proposalModes: Array<'transform' | 'manual-guidance'>; nextStep: string }>;
  };
  providers: ProviderCoverage[];
};

function CoverageBadge({ tone, children }: { tone: 'green' | 'amber' | 'slate'; children: ReactNode }) {
  const colors = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    slate: 'border-[#E8E8E5] bg-[#F6F6F4] text-[#686868]',
  } as const;
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${colors[tone]}`}>{children}</span>;
}

function sourceHealthBadge(status: ProviderCoverage['sourceHealth']['status']): { tone: 'green' | 'amber' | 'slate'; label: string } {
  if (status === 'healthy') return { tone: 'green', label: 'Healthy' };
  if (status === 'failing') return { tone: 'amber', label: 'Failing' };
  if (status === 'due') return { tone: 'amber', label: 'Due' };
  if (status === 'disabled') return { tone: 'slate', label: 'Disabled' };
  return { tone: 'slate', label: 'Never run' };
}

function SourceHealthBadge({ status }: { status: ProviderCoverage['sourceHealth']['status'] }) {
  const badge = sourceHealthBadge(status);
  return <CoverageBadge tone={badge.tone}>{badge.label}</CoverageBadge>;
}

function ParserBadge({ status }: { status: ProviderCoverage['sourceHealth']['parserStatus'] }) {
  if (status === 'structured') return <CoverageBadge tone="green">Structured</CoverageBadge>;
  if (status === 'review-only') return <CoverageBadge tone="amber">Review-only</CoverageBadge>;
  return <CoverageBadge tone="slate">Not run</CoverageBadge>;
}

export default function ProvidersPage() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCoverage() {
    setLoading(true);
    try {
      const response = await fetch('/api/provider-coverage', { cache: 'no-store' });
      const payload = await response.json() as CoverageResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load provider coverage.');
      setData(payload);
      setError(null);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'Unable to load provider coverage.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCoverage(); }, []);

  return (
    <div aria-busy={loading ? 'true' : undefined} className="max-w-[1440px] space-y-6 font-sans text-xs">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E8E8E5] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-medium tracking-tight text-[#111111]">
            <ShieldCheck aria-hidden="true" className="h-6 w-6 text-purple-700" />
            Provider Coverage
          </h1>
          <p className="mt-1 text-xs text-[#686868]">The honest boundary between monitored sources, reviewed rules, scanner coverage, and guarded fixes.</p>
        </div>
        <Button onClick={() => void loadCoverage()} variant="outline" size="sm" disabled={loading} aria-busy={loading ? 'true' : undefined} className="min-h-11" icon={<RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      {error && <DashboardDataError message={error} onRetry={() => void loadCoverage()} busy={loading} />}

      {error ? null : loading ? (
        <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="py-20 text-center text-[#686868]"><Loader2 aria-hidden="true" className="mx-auto mb-2 h-6 w-6 animate-spin text-purple-700" />Loading provider coverage…</div>
      ) : !data ? (
        <div role="status" aria-live="polite" aria-atomic="true" className="rounded-[28px] border border-[#E8E8E5] bg-white p-12 text-center text-[#686868]">Provider coverage is temporarily unavailable.</div>
      ) : data.providers.length === 0 ? (
        <div role="status" aria-live="polite" aria-atomic="true" className="rounded-[28px] border border-[#E8E8E5] bg-white p-12 text-center text-[#686868]">
          <ShieldCheck aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-purple-700" />
          <p className="font-semibold text-base text-[#111111]">No provider coverage records are available yet</p>
          <p className="mt-2 text-xs">Coverage appears here after reviewed provider sources are configured.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Configured sources', data.summary.configuredSources, 'official URLs configured for the six-hour monitor'],
              ['Discovery providers', data.summary.discoveryProviders, 'providers available to inventory discovery'],
              ['Reviewed-rule providers', data.summary.providersWithReviewedRules, 'providers with authoritative rules'],
              ['Reviewed rules', data.summary.reviewedRules, 'rules eligible to affect scans'],
              ['Verified migration templates', data.summary.verifiedMigrationTemplates, `${data.summary.providersWithVerifiedMigrationTemplates} providers have verified executable templates`],
              ['Review-only proposals', data.summary.reviewOnlyTemplateProposals, `${data.summary.providersWithReviewOnlyTemplateProposals} providers have bounded proposals awaiting human promotion`],
            ].map(([label, value, detail]) => (
              <div key={String(label)} className="rounded-2xl border border-[#E8E8E5] bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#686868]">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-[#111111]">{value}</p>
                <p className="mt-1 text-[11px] text-[#686868]">{detail}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Remediation policy</p>
            <p className="mt-2 text-sm font-semibold">Guarded human review</p>
            <p className="mt-1 text-[11px] leading-relaxed">MY OWL can prepare a migration suggestion or draft change when the provider has a deterministic template, but it does not silently modify repositories or auto-merge fixes.</p>
          </section>

          <section className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5" aria-label="Review queue priority summary">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-800">Review queue priority</p><Link href="/dashboard/rules/pending" className="inline-flex min-h-11 items-center rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-purple-800 hover:bg-purple-100">Open review queue</Link></div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-800">P0 · {data.summary.reviewQueue.P0} ready for fixture review</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">P1 · {data.summary.reviewQueue.P1} review-only</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">P2 · {data.summary.reviewQueue.P2} needs evidence</span>
            </div>
          </section>

          {data.summary.migrationTemplatePromotionQueue.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5" aria-label="Migration template promotion queue">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900">Migration template promotion queue</p><p className="mt-1 text-[11px] text-amber-950">These providers have review artifacts but no verified executable template yet.</p></div><CoverageBadge tone="amber">{data.summary.migrationTemplatePromotionQueue.length} providers</CoverageBadge></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {data.summary.migrationTemplatePromotionQueue.map((item) => <div key={item.providerId} className="rounded-xl border border-amber-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-[#111111]">{item.providerId}</span><span className="text-[10px] text-[#686868]">{item.candidateIds.length} candidate{item.candidateIds.length === 1 ? '' : 's'}</span></div><p className="mt-1 font-mono text-[10px] leading-relaxed text-[#686868]">{item.candidateIds.join(', ')}</p><p className="mt-2 text-[10px] leading-relaxed text-amber-950">{item.nextStep}</p></div>)}
            </div>
          </section>}

          <section role="region" aria-label="Provider coverage table" tabIndex={0} className="overflow-x-auto rounded-[28px] border border-[#E8E8E5] bg-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-inset">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="border-b border-[#E8E8E5] bg-[#FAFAF8] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
                <tr><th scope="col" className="px-5 py-4">Provider</th><th scope="col" className="px-5 py-4">Source</th><th scope="col" className="px-5 py-4">Parser</th><th scope="col" className="px-5 py-4">Rules</th><th scope="col" className="px-5 py-4">Scanner</th><th scope="col" className="px-5 py-4">Rescan</th><th scope="col" className="px-5 py-4">Templates</th><th scope="col" className="px-5 py-4">Fix policy</th></tr>
              </thead>
              <tbody>
                {data.providers.map((provider) => (
                  <tr key={provider.providerId} className="border-b border-[#F0F0ED] last:border-0">
                    <td className="px-5 py-4"><div className="font-semibold text-[#111111]">{provider.providerName}</div><div className="font-mono text-[10px] text-[#686868]">{provider.providerId}</div></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2"><CoverageBadge tone="slate">Configured</CoverageBadge><SourceHealthBadge status={provider.sourceHealth.status} />{toSafeExternalUrl(provider.sourceUrl) ? <a href={toSafeExternalUrl(provider.sourceUrl) ?? undefined} target="_blank" rel="noreferrer" aria-label={`Open ${provider.providerName} official source`} className="inline-flex min-h-11 min-w-11 items-center justify-center"><ExternalLink aria-hidden="true" className="h-3.5 w-3.5 text-purple-700" /></a> : <span className="text-xs text-[#686868]">Source unavailable</span>}</div><div className="mt-1 text-[10px] text-[#686868]">{provider.sourceType}</div></td>
                    <td className="px-5 py-4"><ParserBadge status={provider.sourceHealth.parserStatus} /></td>
                    <td className="px-5 py-4"><div className="font-semibold text-[#111111]">{provider.reviewedRuleCount}</div><div className="text-[10px] text-[#686868]">{provider.candidateCount} candidates</div></td>
                    <td className="px-5 py-4">{provider.scannerCoverage === 'reviewed-rules' ? <CoverageBadge tone="green">Reviewed rules</CoverageBadge> : <CoverageBadge tone="amber">Review needed</CoverageBadge>}</td>
                    <td className="px-5 py-4">{provider.autoRescan ? <><CoverageBadge tone="green">Approval + source update</CoverageBadge><p className="mt-2 max-w-[180px] text-[10px] leading-relaxed text-[#686868]">Approved provider changes are queued for an immediate bounded rescan; nightly repository rescans remain separate.</p></> : <CoverageBadge tone="slate">Not yet</CoverageBadge>}</td>
                    <td className="px-5 py-4"><div>{provider.verifiedMigrationTemplateCount > 0 ? <CoverageBadge tone="green">{provider.verifiedMigrationTemplateCount} verified AST</CoverageBadge> : provider.reviewOnlyTemplateProposalCount > 0 ? <CoverageBadge tone="amber">{provider.reviewOnlyTemplateProposalCount} review-only proposal{provider.reviewOnlyTemplateProposalCount === 1 ? '' : 's'}</CoverageBadge> : provider.migrationTemplateStatus === 'deterministic-ast' ? <CoverageBadge tone="amber">Declared only</CoverageBadge> : <CoverageBadge tone="amber">Review-only</CoverageBadge>}</div><p className="mt-2 max-w-[260px] text-[10px] leading-relaxed text-[#686868]">{provider.migrationTemplateLimitation}</p></td>
                    <td className="px-5 py-4"><CoverageBadge tone="amber">Human review</CoverageBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-[11px] leading-relaxed text-[#686868]">A configured source is not proof that deployed cron execution has been observed. A provider is not production scanner-supported until reviewed rules exist; fix generation remains review-gated.</p>
        </>
      )}
    </div>
  );
}
