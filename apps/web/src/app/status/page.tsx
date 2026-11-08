import Link from "next/link";
import { ArrowRight, Activity, ShieldCheck } from "lucide-react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl space-y-12 px-4 pb-24 pt-36 sm:px-6 lg:px-8 outline-none">
        <header className="space-y-4 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-mono font-medium text-slate-800"><Activity className="h-3.5 w-3.5" aria-hidden="true" /><span>SERVICE STATUS</span></div>
          <h1 className="font-serif text-4xl font-normal leading-tight tracking-tight sm:text-5xl">A truthful status surface is coming.</h1>
          <p role="status" aria-live="polite" aria-atomic="true" className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">No live monitor is connected to this public page yet, so it intentionally does not publish invented uptime, incident or “all systems operational” claims.</p>
        </header>
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xs sm:p-8" aria-labelledby="status-source">
          <div className="flex items-start gap-4"><div className="rounded-2xl bg-slate-100 p-3"><ShieldCheck className="h-5 w-5 text-[#000E29]" aria-hidden="true" /></div><div className="space-y-3"><h2 id="status-source" className="font-serif text-2xl font-normal">How incident updates will work</h2><p className="text-sm leading-relaxed text-slate-600">An approved owner or status provider will publish timestamps, severity, affected surface, customer guidance and resolution verification. Until that source is configured, support questions should go through the contact page.</p><Link href="/contact" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#004EE8] hover:underline">Contact support <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div></div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
