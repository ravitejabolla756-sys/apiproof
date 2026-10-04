"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Info, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReviewedChange = {
  providerId: string;
  changeId: string;
  title: string;
  changeType: string;
  officialSourceUrl: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  removalAt: string | null;
  severity: string;
};

type CompatibilityProofResponse = {
  claimsAvailable: boolean;
  reason: string | null;
  changes: ReviewedChange[];
};

export default function CompatibilityPage() {
  const [data, setData] = useState<CompatibilityProofResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCompatibility() {
    setLoading(true);
    try {
      const response = await fetch("/api/compatibility-proof", { cache: "no-store" });
      if (response.ok) setData(await response.json() as CompatibilityProofResponse);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCompatibility(); }, []);

  return (
    <div className="max-w-[1440px] space-y-6 font-sans text-xs">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E8E8E5] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-medium tracking-tight text-[#111111]">
            <ShieldCheck className="h-6 w-6 text-purple-700" />
            Compatibility Intelligence
          </h1>
          <p className="mt-1 text-xs text-[#686868]">
            Reviewed upstream changes and repository-bound compatibility proofs.
          </p>
        </div>
        <Button onClick={() => void loadCompatibility()} variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#686868]">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-purple-700" />
          Loading reviewed compatibility records...
        </div>
      ) : data?.claimsAvailable ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#C6E1FA] bg-[#EBF3FC] p-4 text-[#183B56]">
            <p className="font-semibold">Reviewed records available</p>
            <p className="mt-1">Only records with official-source provenance and reviewed status can produce compatibility claims.</p>
          </div>
          {data.changes.map((change) => (
            <article key={change.changeId} className="space-y-4 rounded-[28px] border border-[#E8E8E5] bg-white p-6 shadow-xs">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-purple-800">{change.providerId}</span>
                    <span className="font-mono text-[10px] text-[#686868]">{change.changeId}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#111111]">{change.title}</h2>
                </div>
                <span className="rounded-full border border-[#E8E8E5] px-2.5 py-1 text-[10px] font-semibold uppercase text-[#686868]">{change.severity}</span>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><dt className="text-[10px] font-semibold uppercase text-[#686868]">Change type</dt><dd className="mt-1 font-mono text-[#111111]">{change.changeType}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase text-[#686868]">Effective</dt><dd className="mt-1 text-[#111111]">{change.effectiveAt ?? "Not specified"}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase text-[#686868]">Removal</dt><dd className="mt-1 text-[#111111]">{change.removalAt ?? "Not specified"}</dd></div>
              </dl>
              <a href={change.officialSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-purple-700 hover:underline">
                Official source <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-[28px] border border-[#E8E8E5] bg-white p-12 text-center shadow-xs">
          <Info className="mx-auto mb-3 h-8 w-8 text-[#686868]" />
          <h2 className="text-base font-semibold text-[#111111]">No reviewed compatibility claims are available</h2>
          <p className="mx-auto mt-2 max-w-xl leading-relaxed text-[#686868]">
            MY OWL will show a provider, version, upstream change, and code location here only after an official change record has been reviewed. Discovery evidence alone does not create a compatibility claim.
          </p>
          {data?.reason && <p className="mt-3 font-mono text-[10px] text-[#686868]">{data.reason}</p>}
        </section>
      )}
    </div>
  );
}
