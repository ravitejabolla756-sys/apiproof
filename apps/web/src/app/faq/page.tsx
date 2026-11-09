import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";

const faqs = [
  {
    question: "What does MY OWL scan?",
    answer: "MY OWL connects to repositories selected through the GitHub App and analyzes supported dependency and API usage patterns. The supported provider catalog and the repository scan evidence are the source of truth for each finding.",
  },
  {
    question: "Does MY OWL write to my default branch?",
    answer: "No automatic default-branch writes or auto-merges are part of the beta safety boundary. Any migration proposal remains subject to human review and the verified GitHub workflow exposed by the connected workspace.",
  },
  {
    question: "What is a finding?",
    answer: "A finding is an evidence-backed compatibility risk associated with a provider change, repository location and observed usage. Detection is not a claim that an application is currently failing in production.",
  },
  {
    question: "Can a finding be marked resolved manually?",
    answer: "Resolution should be shown only after the relevant post-change scan provides evidence. A draft pull request or a planning result alone is not proof that the underlying risk is fixed.",
  },
  {
    question: "What access does the GitHub App need?",
    answer: "The installation is limited to the repositories and permissions approved by the workspace owner. Review the authorization screen and GitHub organization settings before connecting a repository.",
  },
  {
    question: "Do you retain source code?",
    answer: "The product is designed around transient source inspection and stores product metadata and evidence needed for the customer workflow. Review the privacy draft and the actual deployment configuration before relying on a retention promise.",
  },
  {
    question: "Which providers and languages are supported?",
    answer: "Coverage is evidence-backed and changes over time. The public catalog and the repository response identify what was detected for a particular scan. Do not infer support from a provider name that is not present in the reviewed catalog.",
  },
  {
    question: "Are paid plans available?",
    answer: "The current beta may display plan information, but provider-backed checkout and entitlements are not being represented as live in this release. Contact the team for an approved enterprise or beta conversation.",
  },
  {
    question: "How do I report a security issue or service incident?",
    answer: "Use the contact page for the current support path. Security and incident handling depend on the approved operational runbook and monitoring configuration; public status copy will not invent uptime or active incidents.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />
      <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-4xl space-y-12 px-4 pb-24 pt-36 sm:px-6 lg:px-8 outline-none">
        <header className="min-w-0 space-y-5 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 px-3 py-1 text-xs font-mono font-medium text-slate-800">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PRODUCT FAQ</span>
          </div>
          <h1 className="break-words font-serif text-4xl font-normal leading-tight tracking-tight sm:text-5xl">Answers for teams evaluating MY OWL.</h1>
          <p className="break-words max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            A concise guide to repository access, scan evidence, migration review, security boundaries and beta limitations.
          </p>
        </header>

        <section aria-labelledby="faq-heading" className="space-y-3">
          <h2 id="faq-heading" className="sr-only">Frequently asked questions</h2>
          {faqs.map((faq) => (
            <details key={faq.question} className="group min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs open:border-slate-300 sm:px-6">
              <summary className="flex min-h-11 min-w-0 cursor-pointer list-none items-center rounded pr-8 text-sm font-semibold text-[#000E29] marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-2">
                <span className="relative block break-words after:absolute after:right-0 after:top-0 after:text-lg after:font-normal after:text-slate-400 after:content-['+'] group-open:after:content-['−']">{faq.question}</span>
              </summary>
              <p className="break-words max-w-3xl pt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </section>

        <div className="flex min-w-0 flex-col items-start gap-3 rounded-3xl bg-[#000E29] p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <h2 className="break-words font-serif text-2xl font-normal">Need a verified answer for your stack?</h2>
            <p className="break-words mt-1 text-sm text-slate-300">Bring your provider, repository and review requirements to the team.</p>
          </div>
          <Link href="/contact" className="btn-lime inline-flex min-h-11 shrink-0 items-center text-sm">
            Contact support <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
