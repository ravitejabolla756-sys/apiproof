import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { HeroScanViz } from "@/components/landing/hero-scan-viz";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Check,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] font-sans selection:bg-[#111111] selection:text-white">
      <LandingNavbar />

      <main className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-12 md:space-y-16">

        {/* ==================================================
            HERO — LARGE ROUNDED LIGHT HERO SECTION
        ================================================== */}
        <section className="relative rounded-[32px] bg-white border border-[#E8E8E5] p-8 sm:p-12 lg:p-16 overflow-hidden shadow-xs">
          {/* Subtle pastel wash background */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#F4F0FA]/60 via-[#EBF3FC]/50 to-[#EEF7F2]/60 pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* LEFT SIDE 50% */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E8E8E5] text-[11px] font-semibold tracking-wider text-zinc-700 uppercase shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                API COMPATIBILITY INTELLIGENCE
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#111111] leading-[1.12]">
                Know when an API change <span className="font-semibold text-[#111111]">actually affects</span> your code.
              </h1>

              <p className="text-base sm:text-lg text-[#686868] leading-relaxed max-w-xl">
                APIProof traces vendor API and SDK changes to real repository usage, verifies the impact, and prepares safe migration pull requests.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto font-medium text-sm px-6 py-3">
                    <span>START WITH GITHUB</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto font-medium text-sm px-6 py-3">
                    VIEW DEMO
                  </Button>
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#686868]">
                <span className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Read-only analysis by default
                </span>
                <span className="text-zinc-300">|</span>
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Human review before merge
                </span>
              </div>
            </div>

            {/* RIGHT SIDE 50%: ORIGINAL 3D GLASS NETWORK VISUAL */}
            <div className="lg:col-span-6">
              <HeroScanViz />
            </div>
          </div>
        </section>


        {/* ==================================================
            TRUST / PROOF STRIP
        ================================================== */}
        <section className="rounded-[24px] bg-white border border-[#E8E8E5] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="shrink-0 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#686868]">
                PROVEN ON REAL REPOSITORIES
              </div>
              <div className="text-xs text-zinc-400">
                Ground-truth evidence from indexed codebases
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
              <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-semibold text-[#111111]">Bavio-Ai-v1</div>
                <div className="text-xs text-[#686868]">27 Twilio usages indexed</div>
                <StatusPill status="healthy" label="NOT_AFFECTED" />
              </div>

              <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-semibold text-[#111111]">Stripe Fixture</div>
                <div className="text-xs text-[#686868]">Verified AST migration</div>
                <StatusPill status="verified" label="Migration Verified" />
              </div>

              <div className="p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-semibold text-[#111111]">Draft PR #1</div>
                <div className="text-xs text-[#686868]">Review-only isolation</div>
                <StatusPill status="pr_created" label="Human Review Only" />
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            SECTION — REAL IMPACT DETECTION (SOFT MINT/GREEN)
        ================================================== */}
        <section id="product" className="rounded-[32px] bg-[#EEF7F2] border border-[#D1EBE0] p-8 md:p-14 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* LEFT */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D1EBE0] text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                IMPACT ANALYSIS
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111111]">
                Only alert when your code is affected.
              </h2>
              <p className="text-sm sm:text-base text-[#686868] leading-relaxed">
                A dependency version bump or vendor deprecation notice is not automatically a problem. APIProof maps reviewed vendor changes to actual AST usage before creating a finding.
              </p>
              <div>
                <Link href="/dashboard/findings/fnd-1">
                  <Button variant="primary" size="md" className="font-medium text-xs">
                    <span>SEE HOW MATCHING WORKS</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* RIGHT: IMPACT VISUAL PANEL */}
            <div className="lg:col-span-7">
              <div className="rounded-[24px] bg-white border border-[#D1EBE0] p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Stripe breaking change detected
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-medium">
                    AFFECTED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Vendor Change</div>
                    <div className="font-mono text-zinc-900 font-medium truncate mt-0.5">coupon removed</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Matched Symbol</div>
                    <div className="font-mono text-zinc-900 font-medium truncate mt-0.5">subscriptions.create</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5]">
                    <div className="text-[10px] text-[#686868] uppercase font-semibold">Source File</div>
                    <div className="font-mono text-zinc-900 font-medium truncate mt-0.5">src/billing.ts:4</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-1">
                  <div className="text-zinc-400 text-[11px] font-sans">// Source code snippet matched</div>
                  <div className="text-rose-400">- coupon: couponId</div>
                  <div className="text-emerald-400">+ discounts: [{`{ coupon: couponId }`}]</div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            SECTION — NOT AFFECTED PROOF (SOFT LAVENDER)
        ================================================== */}
        <section className="rounded-[32px] bg-[#F4F0FA] border border-[#E4D9F5] p-8 md:p-14 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* LEFT */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E4D9F5] text-[11px] font-semibold uppercase tracking-wider text-purple-900">
                ZERO-NOISE ANALYSIS
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111111]">
                Ignore changes that don't touch your code.
              </h2>
              <p className="text-sm sm:text-base text-[#686868] leading-relaxed">
                Bavio-Ai-v1 uses Twilio across 27 indexed call sites. APIProof checked reviewed Twilio breaking changes and found zero matching impact in the repository.
              </p>
            </div>

            {/* RIGHT: SOFT VISUAL */}
            <div className="lg:col-span-7">
              <div className="rounded-[24px] bg-white border border-[#E4D9F5] p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Bavio-Ai-v1 repository check
                  </div>
                  <StatusPill status="healthy" label="NOT_AFFECTED" />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] text-xs">
                  <div>
                    <span className="font-semibold text-[#111111]">Twilio SDK ^5.12.2</span>
                    <div className="text-[#686868] text-[11px]">27 usages indexed across 10 source files</div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                    0 Matching Findings
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF0FA] border border-[#E4D9F5] text-xs text-purple-950 font-sans space-y-1">
                  <div className="font-semibold">Checked Rules:</div>
                  <div className="text-[11px] text-purple-800">
                    • Twilio Programmable Voice TwiML verb deprecation → No TwiML verb usage matched<br />
                    • Twilio Client SDK v1 legacy token format → No legacy token instantiation matched
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            SECTION — MIGRATIONS (SOFT ICY BLUE)
        ================================================== */}
        <section className="rounded-[32px] bg-[#EBF3FC] border border-[#D0E2F7] p-8 md:p-14 shadow-xs">
          <div className="space-y-8">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D0E2F7] text-[11px] font-semibold uppercase tracking-wider text-blue-900">
                VERIFIED CODE PATCHING
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111111]">
                Go from impact to verified migration.
              </h2>
              <p className="text-sm sm:text-base text-[#686868] leading-relaxed">
                APIProof doesn't just notify—it generates exact AST code refactors, executes full verification checks, and creates review-only GitHub draft pull requests.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* CODE DIFF VISUAL */}
              <div className="lg:col-span-7 bg-white rounded-[24px] border border-[#D0E2F7] p-6 shadow-md flex flex-col justify-between space-y-4">
                <div className="text-xs font-semibold text-zinc-700 flex items-center justify-between">
                  <span>src/billing.ts (AST Refactor)</span>
                  <span className="font-mono text-[11px] text-zinc-400">stripe-subscription-coupon-removed</span>
                </div>

                <div className="rounded-xl bg-zinc-950 p-4 font-mono text-xs text-zinc-200 space-y-2">
                  <div className="text-zinc-500 text-[11px]">// Before</div>
                  <div className="text-rose-400 bg-rose-950/40 p-1.5 rounded">
                    coupon: couponId
                  </div>
                  <div className="text-zinc-500 text-[11px] pt-1">// After (Migrated to Stripe v17+)</div>
                  <div className="text-emerald-400 bg-emerald-950/40 p-1.5 rounded">
                    discounts: [{`{ coupon: couponId }`}]
                  </div>
                </div>
              </div>

              {/* VERIFICATION CHECKLIST */}
              <div className="lg:col-span-5 bg-white rounded-[24px] border border-[#D0E2F7] p-6 shadow-md flex flex-col justify-between space-y-4">
                <div className="text-xs font-semibold text-[#111111]">
                  4-Gate Verification Invariants
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EEF7F2] border border-[#D1EBE0]">
                    <span className="font-medium text-emerald-900">Patch applied cleanly</span>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EEF7F2] border border-[#D1EBE0]">
                    <span className="font-medium text-emerald-900">TypeScript Typecheck</span>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EEF7F2] border border-[#D1EBE0]">
                    <span className="font-medium text-emerald-900">Unit Tests Execution</span>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EEF7F2] border border-[#D1EBE0]">
                    <span className="font-medium text-emerald-900">API Contract Compliance</span>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900">Draft PR #1</span>
                  <span className="text-[11px] text-[#686868]">Human review required</span>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            LARGE CENTER STATEMENT SECTION (EDITORIAL)
        ================================================== */}
        <section className="rounded-[32px] bg-white border border-[#E8E8E5] py-20 px-8 sm:px-16 text-center space-y-6 shadow-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
            VERIFIED MIGRATIONS
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#111111] max-w-4xl mx-auto leading-tight">
            APIProof doesn't guess what changed.
          </h2>

          <p className="text-lg sm:text-xl text-[#686868] max-w-3xl mx-auto font-normal leading-relaxed">
            It traces the vendor change to the <span className="text-[#111111] font-semibold">symbol</span>, the <span className="text-[#111111] font-semibold">repository</span>, the <span className="text-[#111111] font-semibold">file</span>, and the <span className="text-[#111111] font-semibold">exact usage</span>.
          </p>
        </section>


        {/* ==================================================
            HOW IT WORKS — VERTICAL TIMELINE
        ================================================== */}
        <section id="how-it-works" className="rounded-[32px] bg-white border border-[#E8E8E5] p-8 md:p-14 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* LEFT */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
                HOW IT WORKS
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111111]">
                From vendor change to review-ready PR.
              </h2>
              <p className="text-sm sm:text-base text-[#686868] leading-relaxed">
                A simple 5-step continuous process that protects your application code from unexpected upstream SDK breaking changes.
              </p>
            </div>

            {/* RIGHT: TIMELINE ROWS */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-mono font-semibold text-blue-600">01</div>
                <h3 className="text-base font-medium text-[#111111]">Observe vendor changes</h3>
                <p className="text-xs text-[#686868] leading-relaxed">
                  Monitors official release notes, SDK changelogs, and deprecation schedules across primary API providers.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-mono font-semibold text-blue-600">02</div>
                <h3 className="text-base font-medium text-[#111111]">Trace repository usage</h3>
                <p className="text-xs text-[#686868] leading-relaxed">
                  Indexes repository Abstract Syntax Trees (AST) to map imports, method calls, and parameters to exact line numbers.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-mono font-semibold text-blue-600">03</div>
                <h3 className="text-base font-medium text-[#111111]">Verify code impact</h3>
                <p className="text-xs text-[#686868] leading-relaxed">
                  Evaluates whether breaking change rules match indexed call sites, separating unaffected codebases from real findings.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-mono font-semibold text-blue-600">04</div>
                <h3 className="text-base font-medium text-[#111111]">Prepare migration</h3>
                <p className="text-xs text-[#686868] leading-relaxed">
                  Executes AST code transformations and validates against 4 verification gates (build, typecheck, tests, contract).
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#F6F6F4] border border-[#E8E8E5] space-y-1">
                <div className="text-xs font-mono font-semibold text-blue-600">05</div>
                <h3 className="text-base font-medium text-[#111111]">Open review-only PR</h3>
                <p className="text-xs text-[#686868] leading-relaxed">
                  Publishes a GitHub Draft Pull Request on an isolated feature branch. Never merges automatically.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            INTEGRATIONS
        ================================================== */}
        <section id="integrations" className="rounded-[32px] bg-white border border-[#E8E8E5] p-8 md:p-14 shadow-xs">
          <div className="space-y-8">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
                INTEGRATIONS
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111111]">
                Works with APIs your code already depends on.
              </h2>
              <p className="text-sm sm:text-base text-[#686868]">
                Continuous monitoring for core billing, communication, and AI infrastructure dependencies.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#686868] mb-3">
                  Reviewed Intelligence Rules Active
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="px-4 py-2.5 rounded-xl bg-[#EBF3FC] border border-[#C6E1FA] text-xs font-medium text-blue-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Stripe (Billing & Subscriptions)
                  </div>
                  <div className="px-4 py-2.5 rounded-xl bg-[#EBF3FC] border border-[#C6E1FA] text-xs font-medium text-blue-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Twilio (Telephony & Voice)
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8E8E5]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#686868] mb-3">
                  Detected Repository Dependencies
                </div>
                <div className="flex flex-wrap gap-2.5 text-xs text-[#111111]">
                  {["OpenAI", "Supabase", "Groq", "Deepgram", "ElevenLabs", "Sarvam", "Dodo Payments", "Redis"].map((name) => (
                    <span key={name} className="px-3.5 py-2 rounded-xl bg-[#F6F6F4] border border-[#E8E8E5] font-medium">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            REAL ENGINE PROOF (REPLACES FAKE TESTIMONIALS)
        ================================================== */}
        <section className="rounded-[32px] bg-white border border-[#E8E8E5] p-8 md:p-14 shadow-xs">
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
                REAL ENGINE PROOF
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111111]">
                Truthful verification metrics from actual runs.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bavio-Ai-v1 Card */}
              <div className="p-6 rounded-[24px] bg-[#F6F6F4] border border-[#E8E8E5] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#111111]">ravitejabolla756-sys/Bavio-Ai-v1</div>
                    <div className="text-xs text-[#686868]">Real target repository scan</div>
                  </div>
                  <StatusPill status="healthy" label="NOT_AFFECTED" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Files Analyzed</div>
                    <div className="font-semibold text-sm text-[#111111]">390 source files</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Twilio Usages</div>
                    <div className="font-semibold text-sm text-[#111111]">27 call sites</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Integrations</div>
                    <div className="font-semibold text-sm text-[#111111]">9 detected</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Matching Breaking Changes</div>
                    <div className="font-semibold text-sm text-emerald-700">0 findings</div>
                  </div>
                </div>
              </div>

              {/* Stripe Fixture Card */}
              <div className="p-6 rounded-[24px] bg-[#F6F6F4] border border-[#E8E8E5] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#111111]">apiproof-github-fixture</div>
                    <div className="text-xs text-[#686868]">Stripe breaking migration run</div>
                  </div>
                  <StatusPill status="pr_created" label="Draft PR #1" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Breaking Usages</div>
                    <div className="font-semibold text-sm text-rose-700">1 found</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Affected File</div>
                    <div className="font-mono text-xs text-[#111111]">src/billing.ts</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Verification Gates</div>
                    <div className="font-semibold text-sm text-emerald-700">4/4 passed</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E8E8E5]">
                    <div className="text-[#686868] text-[10px]">Pull Request</div>
                    <div className="font-semibold text-xs text-blue-700">Draft PR #1 created</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ==================================================
            FINAL CTA — SOFT PASTEL GRADIENT
        ================================================== */}
        <section className="rounded-[32px] bg-gradient-to-r from-[#F4F0FA] via-[#EBF3FC] to-[#EEF7F2] border border-[#E8E8E5] p-10 md:p-16 text-center space-y-6 shadow-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-zinc-700">
            API COMPATIBILITY INTELLIGENCE
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#111111]">
            Connect your repository.<br />Know what actually breaks.
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/dashboard">
              <Button size="lg" className="font-medium text-sm px-6 py-3">
                <span>CONNECT GITHUB</span>
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="font-medium text-sm px-6 py-3">
                EXPLORE DEMO
              </Button>
            </Link>
          </div>
        </section>

      </main>

      <LandingFooter />
    </div>
  );
}
