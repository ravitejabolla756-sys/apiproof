import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Shield, ArrowRight } from "lucide-react";

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Draft scope",
      content: "This draft describes the intended data-handling model for MY OWL and is provided for owner and legal review. The deployed environment, approved processors and final retention schedule are the authoritative sources for a published policy."
    },
    {
      title: "2. Information We Collect",
      content: "When you create an account or authorize the MY OWL GitHub App, the service may process account identity, workspace membership, selected repository metadata, scan findings, migration evidence and delivery records needed to operate the product. The final list of processors and fields must be confirmed before publication."
    },
    {
      title: "3. How We Use Your Data",
      content: "The product uses this information to authenticate users, enforce workspace access, scan selected repositories, present evidence-backed findings, support human-reviewed migration workflows, deliver authorized notifications and operate approved billing features. A finding or plan is not a guarantee that production code is broken or that a change is safe to merge."
    },
    {
      title: "4. GitHub Permissions & Access Scopes",
      content: "The GitHub installation screen and organization settings show the permissions actually requested for the deployed product. Workspace owners choose the repositories in scope and can revoke access through GitHub. MY OWL's safety boundary prohibits automatic default-branch commits and auto-merges."
    },
    {
      title: "5. Data Retention & Deletion",
      content: "The final retention and deletion behavior depends on the approved account, workspace and operational deletion contract. This draft does not promise a fixed deletion period. Account or repository deletion requests should follow the supported product workflow or the owner-approved privacy contact process once that workflow is available."
    },
    {
      title: "6. Security & Encryption",
      content: "Security controls include authenticated sessions, workspace authorization, CSRF protections and GitHub webhook verification in the application code. Transport, storage encryption, processor controls and operational monitoring must be verified against the deployed environment before this statement is treated as a final security representation."
    },
    {
      title: "7. Your Rights Under GDPR & CCPA",
      content: "Depending on jurisdiction, applicable law may provide rights such as access, correction, portability or deletion. The final response process, retention exceptions and verification requirements require owner and legal review."
    },
    {
      title: "8. Contact Us",
      content: "If you have questions regarding this Privacy Policy or our security practices, contact us at privacy@myowl.dev or security@myowl.dev."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-12 outline-none">

        {/* HEADER */}
        <div className="space-y-4 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <Shield className="w-3.5 h-3.5 text-slate-700" />
            <span>LEGAL &amp; COMPLIANCE</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#000E29] tracking-tight leading-[1.15]">
            Privacy Policy
          </h1>
          <p className="text-xs font-mono text-slate-500">
            Draft for owner and legal review · Not an effective policy
          </p>
          <p className="text-xs font-mono text-slate-500" data-testid="legal-draft-metadata">
            Draft version 0.1 · Effective date: pending owner/legal approval
          </p>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed pt-2">
            This Privacy Policy explains how MY OWL collects, uses, and safeguards information when you connect your repositories to our breaking change intelligence service.
          </p>
        </div>

        {/* POLICY SECTIONS */}
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
            Protected repositories, verifiable safety.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect GitHub in seconds. Automatic AST impact detection, verified migration plans, and zero direct branch writes.
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
