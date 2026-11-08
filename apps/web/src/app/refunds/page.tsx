import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl space-y-10 px-4 pb-24 pt-36 sm:px-6 lg:px-8 outline-none">
        <header className="space-y-4 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-mono font-medium text-slate-800">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>REFUND POLICY DRAFT</span>
          </div>
          <h1 className="font-serif text-4xl font-normal leading-tight tracking-tight sm:text-5xl">Billing and refunds</h1>
          <p className="text-xs font-mono text-slate-500">Draft for owner and legal review. Not an effective commercial policy.</p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-3"><h2 className="font-serif text-2xl font-normal text-[#000E29]">Current beta position</h2><p>MY OWL is operating with a free beta experience in this repository. Paid checkout, provider-backed subscription changes, invoices and refund commitments must not be represented as active until the approved billing provider and signed webhook reconciliation are available.</p></section>
          <section className="space-y-3"><h2 className="font-serif text-2xl font-normal text-[#000E29]">Future paid subscriptions</h2><p>When a paid plan is approved, the final policy must state the provider, currency, renewal timing, cancellation effect, failed-payment handling, enterprise exceptions and any applicable statutory rights. Those values must be sourced from the canonical billing contract rather than copied from a marketing page.</p></section>
          <section className="space-y-3"><h2 className="font-serif text-2xl font-normal text-[#000E29]">Questions and review</h2><p>For a beta or enterprise conversation, use the <Link href="/contact" className="font-semibold text-[#004EE8] underline underline-offset-2">contact page</Link>. This draft does not create an entitlement, payment obligation or refund promise.</p></section>
        </div>

        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-[#004EE8] hover:underline">Review beta pricing language <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </main>
      <LandingFooter />
    </div>
  );
}
