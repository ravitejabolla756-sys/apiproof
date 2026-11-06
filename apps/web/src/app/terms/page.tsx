import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { FileText, ArrowRight } from "lucide-react";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: "By creating an account, installing the MY OWL GitHub App, or utilizing the MY OWL platform ('Service'), you ('Customer' or 'User') agree to be bound by these Terms & Conditions. If you are entering into this agreement on behalf of a company or legal entity, you represent that you possess the authority to bind such entity."
    },
    {
      title: "2. Description of Service",
      content: "MY OWL provides account, workspace, repository analysis and evidence-backed compatibility workflows for supported languages and provider catalogs. Availability and exact capabilities depend on the deployed beta configuration and approved integrations."
    },
    {
      title: "3. Human Review & Draft-Only Guarantee",
      content: "All code patches and migration proposals produced by MY OWL are delivered solely as GitHub Draft Pull Requests on isolated branches (apiproof/*). MY OWL does not auto-merge code into your production or default branches. Customer retains sole responsibility for reviewing, testing, verifying, and merging any proposed changes into their codebases."
    },
    {
      title: "4. Intellectual Property & Code Ownership",
      content: "You retain all right, title, and interest in and to your source code, repositories, and software applications. MY OWL claims no intellectual property rights over any code analyzed or migration patches generated. We do not store your source code persistently, nor do we train generative AI models on your code."
    },
    {
      title: "5. GitHub App Scopes & Security Invariants",
      content: "Customer grants only the permissions shown by the GitHub OAuth or GitHub App installation flow. Customer may revoke or modify repository access through GitHub settings. The deployed permission set and product configuration control whether any draft-PR workflow is available."
    },
    {
      title: "6. Billing, subscriptions and cancellation",
      content: "The current beta does not represent mock billing behavior as a live paid entitlement. If paid subscriptions are activated, the approved provider, canonical plan catalog, checkout terms, renewal timing, cancellation behavior and refund policy will govern. Those terms must be published and reviewed before paid activation."
    },
    {
      title: "7. Disclaimer of Warranties",
      content: "THE SERVICE IS PROVIDED ON AN 'AS IS' AND 'AS AVAILABLE' BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WHILE MY OWL APPLIES MULTI-GATE VERIFICATION HARNESSES, WE DO NOT GUARANTEE THAT ALL UPSTREAM BREAKING CHANGES WILL BE DETECTED OR THAT ALL PROPOSED PATCHES ARE FIT FOR SPECIFIC PRODUCTION ENVIRONMENTS WITHOUT HUMAN OVERSIGHT."
    },
    {
      title: "8. Limitation of Liability",
      content: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL MY OWL OR ITS AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION, ARISING FROM THE USE OF OR INABILITY TO USE THE SERVICE."
    },
    {
      title: "9. Modifications to Terms",
      content: "We reserve the right to modify these Terms at any time. Continued use of the Service following notice of revised Terms constitutes your acceptance of the changes."
    },
    {
      title: "10. Contact",
      content: "For questions concerning these Terms, contact us at legal@myowl.dev."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-12 outline-none">

        {/* HEADER */}
        <div className="space-y-4 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <FileText className="w-3.5 h-3.5 text-slate-700" />
            <span>LEGAL AGREEMENT</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#000E29] tracking-tight leading-[1.15]">
            Terms &amp; Conditions
          </h1>
          <p className="text-xs font-mono text-slate-500">
            Draft for owner and legal review · Not an effective agreement
          </p>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed pt-2">
            Please read these Terms &amp; Conditions carefully before installing the MY OWL GitHub App or accessing our breaking change detection platform.
          </p>
        </div>

        {/* TERMS SECTIONS */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="rounded-[24px] bg-[#EFF1F5] p-6 sm:p-8 border border-black/[0.04] space-y-3">
              <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#000E29]">
                {section.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Built for engineering teams with high standards.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Continuous breaking change intelligence with strict read-only observation and human review guarantees.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime text-sm px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 inline-flex items-center gap-2"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
