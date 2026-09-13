"use client";

import { useState } from "react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { Mail, ShieldCheck, CheckCircle2, Send } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] font-sans selection:bg-[#111111] selection:text-white">
      <LandingNavbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 md:py-20">

        <div className="rounded-[32px] bg-white border border-[#E8E8E5] p-8 md:p-16 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

            {/* LEFT 5 COLUMNS */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
                CONTACT
              </div>

              <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#111111]">
                Talk to APIProof
              </h1>

              <p className="text-base text-[#686868] leading-relaxed">
                Connect with our engineering team for private beta access, custom provider integration requests, or security architecture reviews.
              </p>

              <div className="space-y-4 pt-4 border-t border-[#E8E8E5] text-xs">
                <div className="flex items-center gap-3 text-[#111111]">
                  <div className="w-8 h-8 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-center">
                    <Mail className="w-4 h-4 text-zinc-700" />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Direct Email</div>
                    <div className="font-mono text-sm font-medium">contact@apiproof.dev</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[#111111]">
                  <div className="w-8 h-8 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Security Inquiries</div>
                    <div className="font-mono text-sm font-medium">security@apiproof.dev</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT 7 COLUMNS: FORM */}
            <div className="lg:col-span-7 bg-[#F6F6F4] rounded-[24px] border border-[#E8E8E5] p-6 sm:p-10 space-y-6">
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#111111]">Message Received</h3>
                  <p className="text-xs text-[#686868] max-w-md mx-auto">
                    Thank you for reaching out. Our engineering team will review your message and get back to you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[#111111]">Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Alex Morgan"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[#111111]">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="alex@company.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-[#111111]">Company / Organization</label>
                    <input
                      type="text"
                      placeholder="Acme Engineering"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-[#111111]">Message</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Tell us about your codebase, active dependencies, or security questions..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8E8E5] text-[#111111] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/20 resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <Button type="submit" size="lg" className="w-full font-medium">
                      <span>SEND MESSAGE</span>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
