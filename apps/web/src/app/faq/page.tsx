import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";

export const metadata = {
  title: "FAQ | MY OWL",
  description:
    "Answers about MY OWL repository access, analysis, migration proposals, billing availability, and support.",
};

const faqs = [
  {
    question: "What does MY OWL analyze?",
    answer:
      "MY OWL analyzes supported repository metadata, package manifests, and source locations needed to map API or SDK changes to real usage. The product documentation describes the current supported analysis path and its limitations.",
  },
  {
    question: "Does MY OWL write directly to the default branch?",
    answer:
      "No. Proposed changes are review-only. The documented workflow uses an isolated branch and a draft pull request so your team can inspect the evidence and decide what to merge.",
  },
  {
    question: "What permissions does the GitHub connection use?",
    answer:
      "The GitHub App is designed around least-privilege repository access. The security documentation describes read access for analysis and restricted draft-pull-request writes; you choose which repositories are connected and can revoke access in GitHub.",
  },
  {
    question: "Can a workspace member access another workspace?",
    answer:
      "No. Workspace scope and role are derived on the server for protected actions. A missing membership, revoked membership, or cross-workspace request is rejected rather than trusted from client-provided workspace data.",
  },
  {
    question: "Why might billing or invoice history be unavailable?",
    answer:
      "Billing and invoice providers are intentionally fail-closed until an approved provider and environment are configured. When the provider is unavailable, MY OWL returns an unavailable state instead of fabricating invoices or subscription data.",
  },
  {
    question: "How do I report a security issue or request support?",
    answer: (
      <>
        Use the <Link href="/contact" className="font-semibold text-[#004EE8] underline underline-offset-4">contact form</Link> for product support and enterprise questions. For security and privacy concerns, use the addresses listed in the <Link href="/security" className="font-semibold text-[#004EE8] underline underline-offset-4">security</Link> and <Link href="/privacy" className="font-semibold text-[#004EE8] underline underline-offset-4">privacy</Link> pages.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 pb-24 pt-36 sm:px-6 lg:px-8">
        <header className="space-y-5 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-mono font-medium text-slate-800">
            <CircleHelp className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
            <span>SUPPORT &amp; PRODUCT QUESTIONS</span>
          </div>
          <h1 className="font-serif text-4xl font-normal leading-[1.15] tracking-tight text-[#000E29] sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            A concise guide to the current MY OWL workflow. Provider-backed and hosted capabilities remain subject to their documented availability and release gates.
          </p>
        </header>

        <section aria-labelledby="faq-heading" className="mt-12 space-y-4">
          <h2 id="faq-heading" className="sr-only">MY OWL frequently asked questions</h2>
          {faqs.map((faq) => (
            <details key={faq.question} className="group rounded-2xl border border-black/[0.08] bg-white px-5 py-4 shadow-sm sm:px-7">
              <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-[#000E29] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {faq.question}
                  <span aria-hidden="true" className="text-xl font-normal text-[#004EE8] transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <div className="pt-3 text-sm leading-7 text-slate-600">{faq.answer}</div>
            </details>
          ))}
        </section>
      </main>

      <section className="relative w-full overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] px-4 py-24 text-center text-white sm:px-6">
        <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center space-y-6">
          <h2 className="font-serif text-4xl font-normal leading-tight sm:text-5xl">Need a direct answer?</h2>
          <p className="max-w-lg text-sm leading-relaxed text-slate-200 sm:text-base">
            Tell us what you are evaluating and the team can clarify the current product boundary.
          </p>
          <Link href="/contact" className="btn-lime inline-flex items-center gap-2 px-8 py-3.5 text-sm shadow-[0_0_30px_rgba(208,241,0,0.45)] transition hover:scale-105 active:scale-95">
            Contact support <ArrowRight className="h-4 w-4 text-black stroke-[2.5]" aria-hidden="true" />
          </Link>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}
