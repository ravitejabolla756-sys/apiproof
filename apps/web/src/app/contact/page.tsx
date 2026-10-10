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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-20 space-y-16">

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
              Questions about protected repositories, custom vendor breaking change rules, security boundaries, or enterprise self-hosted deployment? We&apos;re here to assist.
            </p>
          </div>

          {/* Right Column: Form Card */}
          <div className="lg:col-span-7 bg-[#EFF1F5] rounded-[32px] p-8 md:p-10 border border-black/[0.04] shadow-xs">
            {submitted ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-2xl text-[#000E29]">Message Received</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Thank you for reaching out. A MY OWL engineer will review your inquiry and follow up within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-medium text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Alex Rivera"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-medium text-slate-700">Work Email</label>
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-slate-700">Inquiry Type</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] focus:outline-none focus:ring-2 focus:ring-black/10"
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
                  <label className="font-medium text-slate-700">How can we help?</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell us about your tech stack, repository setup, or technical question..."
                    className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[#000E29] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="px-8 py-3 rounded-full bg-[#000E29] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs"
                >
                  Send Inquiry
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
              <h3 className="font-serif text-lg text-[#000E29] font-medium">Enterprise Deployment</h3>
              <p className="text-xs text-slate-600">Private runners, GitHub Enterprise Server, VPC peering, and custom SLAs.</p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 font-mono">enterprise@myowl.dev</span>
          </div>

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg text-[#000E29] font-medium">Security &amp; AST Isolation</h3>
              <p className="text-xs text-slate-600">Strict read-only tree inspection, transient in-memory parsing, zero persistent code retention.</p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 font-mono">security@myowl.dev</span>
          </div>

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <FileCode className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg text-[#000E29] font-medium">Custom API Rules</h3>
              <p className="text-xs text-slate-600">Configure breaking change detection for private internal microservices and SDKs.</p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 font-mono">rules@myowl.dev</span>
          </div>

          <div className="rounded-[28px] bg-[#EFF1F5] p-6 border border-black/[0.04] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-slate-900">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg text-[#000E29] font-medium">Technical Support</h3>
              <p className="text-xs text-slate-600">Assistance with GitHub App permissions, scan triggers, or 4-gate verification errors.</p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 font-mono">support@myowl.dev</span>
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
            Connect GitHub in seconds for read-only AST observation and evidence-linked compatibility findings.
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
