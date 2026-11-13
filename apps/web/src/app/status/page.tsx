import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleCheck, Clock3 } from "lucide-react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";

export const metadata: Metadata = {
  title: "Product status | MY OWL",
  description: "Current MY OWL product availability boundaries and release-gated services.",
};

const statusItems = [
  { name: "Public website", status: "Available", tone: "available", description: "Public product, documentation, support, privacy, and security pages are available." },
  { name: "Authenticated dashboard", status: "Release-gated", tone: "gated", description: "Requires an approved authentication environment and an authorized workspace membership." },
  { name: "Repository analysis", status: "Release-gated", tone: "gated", description: "Requires an authorized GitHub installation, repository scope, and the applicable scan worker." },
  { name: "Review-only draft pull requests", status: "Release-gated", tone: "gated", description: "Proposals remain review-only and require verified evidence before any repository write is available." },
  { name: "Billing and invoice providers", status: "Not enabled", tone: "disabled", description: "Checkout, portal, and provider-backed invoices remain unavailable until an approved provider environment exists." },
  { name: "Email and digest delivery", status: "Not enabled", tone: "disabled", description: "Outbound delivery remains fail-closed until provider, sender, template, and retention decisions are approved." },
  { name: "Database isolation and recovery", status: "Verification required", tone: "pending", description: "PostgreSQL isolation, backup/restore, migration history, and rollback evidence require an approved rehearsal." },
] as const;

function StatusIcon({ tone }: { tone: (typeof statusItems)[number]["tone"] }) {
  if (tone === "available") return <CircleCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
  if (tone === "disabled") return <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />;
  return <Clock3 className="h-5 w-5 text-blue-600" aria-hidden="true" />;
}

export const StatusPage = () => (
  <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
    <LandingNavbar />
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-24 pt-36 sm:px-6 lg:px-8">
      <header className="space-y-5 border-b border-black/[0.08] pb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-mono font-medium text-slate-800"><Clock3 className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" /><span>PRODUCT STATUS</span></div>
        <h1 className="font-serif text-4xl font-normal leading-[1.15] tracking-tight text-[#000E29] sm:text-5xl">Honest availability, by product boundary.</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">This page describes the current MY OWL release boundary. It is not a live uptime monitor and does not claim that a release-gated service is production-ready.</p>
      </header>
      <section aria-labelledby="status-heading" className="mt-12 space-y-4">
        <h2 id="status-heading" className="sr-only">MY OWL service status</h2>
        {statusItems.map((item) => (
          <article key={item.name} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:px-7">
            <div className="flex min-w-0 items-start gap-3"><StatusIcon tone={item.tone} /><div className="min-w-0"><h3 className="break-words text-base font-semibold text-[#000E29]">{item.name}</h3><p className="mt-1 break-words text-sm leading-6 text-slate-600">{item.description}</p></div></div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${item.tone === "available" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : item.tone === "disabled" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{item.status}</span>
          </article>
        ))}
      </section>
      <aside className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950 sm:p-7" role="note"><p className="font-semibold">Need help with an unavailable capability?</p><p className="mt-1">Contact support for the current access boundary, onboarding requirements, or provider decision status.</p><Link href="/contact" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-[#004EE8] underline underline-offset-4">Contact support <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></aside>
    </main>
    <LandingFooter />
  </div>
);

export default StatusPage;
