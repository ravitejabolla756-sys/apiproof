import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Code2, Network, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] font-sans selection:bg-[#111111] selection:text-white">
      <LandingNavbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 md:py-20 space-y-16">

        {/* EDITORIAL SPLIT */}
        <div className="rounded-[32px] bg-white border border-[#E8E8E5] p-8 md:p-16 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* LEFT 5 COLUMNS */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
                ABOUT MY OWL
              </div>
              <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#111111] leading-tight">
                APIs change.<br />
                <span className="font-semibold text-[#111111]">Your code shouldn't fail silently.</span>
              </h1>
            </div>

            {/* RIGHT 7 COLUMNS */}
            <div className="lg:col-span-7 space-y-6 text-[#686868] text-base leading-relaxed">
              <p className="text-lg text-[#111111] font-medium">
                MY OWL helps engineering teams understand whether upstream API and SDK changes actually affect their codebase.
              </p>
              <p>
                Modern applications rely on dozens of vendor APIs—from payment processors like Stripe to communications providers like Twilio and AI infrastructure providers like OpenAI. When a vendor updates their SDK or deprecates a parameter, software teams face a silent dilemma: spend hours auditing every call site manually, or risk breaking production.
              </p>
              <p>
                MY OWL bridges this gap by indexing repository Abstract Syntax Trees (ASTs), matching reviewed vendor breaking change rules to actual symbol usages, and executing 4-gate verification pipelines before generating human-reviewable draft pull requests.
              </p>
              <div className="pt-2">
                <Link href="/dashboard">
                  <Button size="md" className="font-medium text-xs">
                    <span>EXPLORE THE ENGINE</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ABSTRACT DEPENDENCY TOPOLOGY VISUAL */}
        <div className="rounded-[32px] bg-gradient-to-br from-[#F4F0FA] via-[#EBF3FC] to-[#EEF7F2] border border-[#E8E8E5] p-8 md:p-14 shadow-xs">
          <div className="space-y-6 text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
              DEPENDENCY TOPOLOGY ENGINE
            </div>
            <h2 className="text-3xl font-medium tracking-tight text-[#111111]">
              Traceable AST Graph Matching
            </h2>
            <p className="text-xs text-[#686868]">
              MY OWL constructs an exact graph mapping third-party symbols to repository call sites.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto bg-white/80 backdrop-blur-md rounded-[24px] border border-white/80 p-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* NODE 1 */}
            <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                <Network className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-[#111111]">1. Vendor Change Registry</div>
              <p className="text-xs text-[#686868] leading-relaxed">
                Reviewed breaking change rules parsed from official vendor release notes and SDK changelogs.
              </p>
            </div>

            {/* NODE 2 */}
            <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
              <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700">
                <Code2 className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-[#111111]">2. AST Repository Index</div>
              <p className="text-xs text-[#686868] leading-relaxed">
                Read-only analysis indexing call sites, parameter names, and SDK version constraints across files.
              </p>
            </div>

            {/* NODE 3 */}
            <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-[#111111]">3. Verified Refactoring</div>
              <p className="text-xs text-[#686868] leading-relaxed">
                Automated patch generation verified against typecheck and unit tests before opening a draft PR.
              </p>
            </div>

          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
