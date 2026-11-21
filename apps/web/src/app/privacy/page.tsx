import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Shield, ArrowRight } from "lucide-react";

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Core Philosophy: Zero Source Code Retention",
      content: "MY OWL is designed specifically for security-conscious development teams. We process your TypeScript and JavaScript source code strictly in-memory during AST analysis passes. We do not persistently store, archive, or duplicate your source code on our servers, and we never use customer code to train machine learning models."
    },
    {
      title: "2. Information We Collect",
      content: "When you authorize the MY OWL GitHub App, we collect: (a) GitHub profile information including your GitHub user ID, username, and verified email address; (b) repository metadata including repository IDs, names, and default branch configurations for the repositories you select; and (c) package manifest files (such as package.json) to detect upstream dependencies and SDK versions."
    },
    {
      title: "3. How We Use Your Data",
      content: "Collected metadata is used solely to: (a) identify when monitored vendor APIs release breaking changes affecting your installed packages; (b) trace whether your repository invokes deprecated or modified call sites; (c) generate 4-gate verified migration proposals and push isolated draft pull requests to your repositories; and (d) manage your subscription tier."
    },
    {
      title: "4. GitHub Permissions & Access Scopes",
      content: "Our GitHub App requests read-only access to repository contents and issues for AST inspection, and write access restricted to opening Draft Pull Requests on isolated branches (apiproof/*). You maintain complete control over which repositories MY OWL can access, and permissions can be revoked at any time through your GitHub Settings."
    },
    {
      title: "5. Data Retention & Deletion",
      content: "If you disconnect a repository or uninstall the MY OWL GitHub App, all associated repository metadata, scan records, and finding summaries are permanently removed from our active databases within 30 days. You may request immediate deletion of all account data by contacting privacy@myowl.dev."
    },
    {
      title: "6. Security & Encryption",
      content: "All communication between your browser, our servers, and GitHub APIs is encrypted in transit using TLS 1.3. Any persisted metadata, authentication tokens, and audit logs are encrypted at rest using industry-standard AES-256 encryption."
    },
    {
      title: "7. Your Rights Under GDPR & CCPA",
      content: "Depending on your jurisdiction, you may have the right to access, correct, port, or erase personal data held about you. Because we retain only minimal account metadata and no customer source code, fulfilling data export or erasure requests is straightforward and honored promptly."
    },
    {
      title: "8. Contact Us",
      content: "If you have questions regarding this Privacy Policy or our security practices, contact us at privacy@myowl.dev or security@myowl.dev."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-12">

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
            Last updated: March 2026 · Effective immediately
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
