import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Cookie, ArrowRight } from "lucide-react";

export default function CookiesPage() {
  const sections = [
    {
      title: "1. What Are Cookies?",
      content: "Cookies are small text files placed on your computer or mobile device by websites that you visit. They are widely used to make web applications work reliably, securely, and efficiently."
    },
    {
      title: "2. Our Minimalist Approach: No Ad Trackers",
      content: "MY OWL takes a strict developer-first stance on user privacy. We do not use third-party advertising cookies, retargeting pixels, or data broker scripts. We use only strictly necessary cookies and functional preferences essential to running our platform."
    },
    {
      title: "3. Categories of Cookies We Use",
      content: "We categorize the cookies used on MY OWL into two groups: (a) Strictly Necessary Cookies, which are required for authentication, CSRF mitigation, and session integrity; and (b) Functional Storage, which remembers basic user interface preferences like sidebar toggle states."
    },
    {
      title: "4. Specific Cookies Deployed",
      content: "• myowl_session: Encrypted session token used to verify authentication across requests (HttpOnly, Secure).\n• csrf_token: Cryptographic token preventing cross-site request forgery attacks.\n• repo_view_pref: Local storage item recording table sorting or filter preferences in your dashboard."
    },
    {
      title: "5. How to Control or Disable Cookies",
      content: "You can manage cookie settings directly within your browser preferences (e.g., Chrome, Firefox, Safari, Edge). Please note that disabling strictly necessary cookies will prevent you from signing in and accessing your MY OWL dashboard."
    },
    {
      title: "6. Changes to this Policy",
      content: "We may update this Cookie Policy from time to time to reflect changes in our legal obligations or platform features. Any updates will be posted on this page with a revised effective date."
    },
    {
      title: "7. Contact",
      content: "If you have questions about our use of cookies or technical storage, contact us at privacy@myowl.dev."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-12 outline-none">

        {/* HEADER */}
        <div className="space-y-4 border-b border-black/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <Cookie aria-hidden="true" className="w-3.5 h-3.5 text-slate-700" />
            <span>BROWSER STORAGE</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#000E29] tracking-tight leading-[1.15]">
            Cookie Policy
          </h1>
          <p className="text-xs font-mono text-slate-500">
            Last updated: March 2026 · Effective immediately
          </p>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed pt-2">
            This Cookie Policy describes how MY OWL uses essential cookies and local storage to operate a safe, authentication-protected platform.
          </p>
        </div>

        {/* COOKIE SECTIONS */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="rounded-[24px] bg-[#EFF1F5] p-6 sm:p-8 border border-black/[0.04] space-y-3">
              <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#000E29]">
                {section.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
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
            Clear code intelligence without tracker bloat.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect your repositories in 60 seconds. Strict read-only AST safety.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime min-h-11 text-sm px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 inline-flex items-center gap-2"
            >
              <span>Connect GitHub Free</span>
              <ArrowRight aria-hidden="true" className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
