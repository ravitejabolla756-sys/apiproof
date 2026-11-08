"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { CheckCircle2, ArrowRight, ShieldCheck, Server, FileCode, HelpCircle } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-20 space-y-16 outline-none">

        {/* TOP SECTION: HEADING + FORM */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left Column */}
          <div className="lg:col-span-5 space-y-4 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-medium">
              <span>TALK WITH OUR ENGINEERS</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal text-[#000E29] leading-[1.1]">
              Connect with the MY OWL Team
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md">
              Questions about the beta workflow, repository permissions, or planned enterprise evaluation? We&apos;ll show you what is available today and what still needs review.
            </p>
          </div>

          {/* Right Column: Form Card */}
          <div className="lg:col-span-7 bg-[#EFF1F5] rounded-[32px] p-8 md:p-10 border border-black/[0.04] shadow-xs">
            {submitted ? (
              <div role="status" aria-live="polite" aria-atomic="true" className="py-16 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="font-serif text-2xl text-[#000E29]">No message was sent</h2>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Contact intake is not connected to a delivery service in this beta. Please use an owner-provided support channel before sharing sensitive details.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="contact-name" className="font-medium text-slate-700">Full Name</label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      placeholder="Alex Rivera"
                      className="min-h-11 w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-email" className="font-medium text-slate-700">Work Email</label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      placeholder="alex@company.com"
                      className="min-h-11 w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-type" className="font-medium text-slate-700">Inquiry Type</label>
                  <select
                    id="contact-type"
                    className="min-h-11 w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] focus:outline-none focus:ring-2 focus:ring-black/10"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>Select inquiry type...</option>
                    <option value="enterprise">Protected Repositories &amp; Enterprise Pricing</option>
                    <option value="custom-rules">Custom Vendor Breaking Change Rules</option>
                    <option value="security">Security, AST Isolation &amp; Zero-Code Retention</option>
                    <option value="self-hosted">Self-Hosted / GitHub Enterprise Server</option>
                    <option value="support">Technical Support &amp; Verification Gates</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="contact-message" className="font-medium text-slate-700">How can we help?</label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    placeholder="Tell us about your tech stack, repository setup, or technical question..."
                    className="min-h-11 w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="min-h-11 px-8 py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs"
                >
                  Review inquiry state
                </button>
              </form>
            )}
          </div>

        </div>

        {/* 4 SUPPORT TOPIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-8">

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <Server className="w-4 h-4" />
              </div>
              <h2 className="font-serif text-lg text-[#000E29] font-medium">Enterprise Deployment</h2>
              <p className="text-xs text-slate-600">Questions about private runners, GitHub Enterprise Server, or future deployment options.</p>
            </div>
              <span className="text-[11px] font-semibold text-slate-600 font-mono">Owner-provided contact only</span>
          </div>

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="font-serif text-lg text-[#000E29] font-medium">Security &amp; AST Isolation</h2>
              <p className="text-xs text-slate-600">Read-only inspection and evidence boundaries documented for beta review.</p>
            </div>
              <span className="text-[11px] font-semibold text-slate-600 font-mono">See the security page</span>
          </div>

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <FileCode className="w-4 h-4" />
              </div>
              <h2 className="font-serif text-lg text-[#000E29] font-medium">Custom API Rules</h2>
              <p className="text-xs text-slate-600">Discuss future rule coverage for private internal services and SDKs.</p>
            </div>
              <span className="text-[11px] font-semibold text-slate-600 font-mono">Planned evaluation</span>
          </div>

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h2 className="font-serif text-lg text-[#000E29] font-medium">Technical Support</h2>
              <p className="text-xs text-slate-600">Review the beta documentation for GitHub permissions and scan boundaries.</p>
            </div>
              <span className="text-[11px] font-semibold text-slate-600 font-mono">No staffed inbox is connected</span>
          </div>

        </div>

      </main>

      {/* PRE-FOOTER RADIANT GRADIENT CTA */}
      <section className="relative w-full py-28 px-4 sm:px-6 overflow-hidden bg-[linear-gradient(0deg,#001033_0%,#0050F8_55%,#5FBDF7_85%,#FAFAFA_100%)] text-white text-center">
        <div className="absolute inset-0 bg-star-pattern opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
          <h2 className="font-serif text-4xl sm:text-5xl font-normal leading-tight">
            Protect your repositories from breaking API changes.
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-lg leading-relaxed">
            Connect GitHub in seconds. Read-only AST observation, deterministic migration planning, and safe draft PRs.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="btn-lime min-h-11 text-sm px-8 py-3.5 shadow-[0_0_30px_rgba(208,241,0,0.45)] hover:scale-105 active:scale-95 inline-flex items-center gap-2"
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
