import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { HeroGlassSculpture } from "@/components/landing/hero-glass-sculpture";
import { ImpactArtwork } from "@/components/landing/impact-artwork";
import { ZeroNoiseArtwork } from "@/components/landing/zero-noise-artwork";
import { MigrationArtwork } from "@/components/landing/migration-artwork";
import { IntegrationsOrbit } from "@/components/landing/integrations-orbit";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#0F172A] font-sans selection:bg-sky-500/20">
      
      {/* GLOBAL FLOATING PILL NAVBAR */}
      <LandingNavbar />

      <main className="max-w-[1380px] mx-auto px-4 md:px-8 space-y-6 pt-2 pb-16">

        {/* =========================================================================
            CARD 1: HERO SECTION — 1:1 SynthAI Live Architecture
           ========================================================================= */}
        <section className="synth-card p-8 md:p-14 min-h-[660px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative overflow-hidden">
          
          {/* Ambient Top-Right Soft Glow */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-sky-200/20 via-purple-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* LEFT 50%: Hero Text Composition */}
          <div className="lg:col-span-6 z-10 flex flex-col justify-center max-w-xl">
            {/* Monospace Eyebrow Tag */}
            <div className="font-mono text-xs uppercase tracking-widest text-slate-600 mb-6 flex items-center gap-2">
              <span className="text-[#0F172A]">✦</span>
              <span>API COMPATIBILITY INTELLIGENCE</span>
            </div>

            {/* Headline: Clean Geometric Sans */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-tight text-[#0F172A] leading-[1.08] mb-6">
              Know when an API change <br className="hidden sm:block" />
              affects your code.
            </h1>

            {/* Body Copy */}
            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed mb-8 max-w-lg">
              APIProof maps vendor SDK changes to real repository usage, verifies the impact deterministically, and prepares safe migration pull requests.
            </p>

            {/* 1:1 SynthAI Monospace Uppercase Buttons (rounded-lg) */}
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/dashboard" className="btn-synth-black">
                <span>START NOW</span>
                <span>↗</span>
              </Link>
              <Link href="/#product" className="btn-synth-outline">
                <span>VIEW DEMO</span>
              </Link>
            </div>
          </div>

          {/* RIGHT 50%: Massive 3D Iridescent Glass Sculpture */}
          <div className="lg:col-span-6 relative w-full flex items-center justify-center">
            <HeroGlassSculpture />
          </div>

        </section>

        {/* =========================================================================
            CARD 2: PROOF / PARTNER LOGO STRIP
           ========================================================================= */}
        <section className="synth-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="font-mono text-xs text-slate-600 flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Trusted by <strong>500+</strong> <strong>engineering teams</strong> of all sizes</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-[#0F172A] divide-x divide-[#E8E8E5]">
            <div className="pl-4">
              <span className="font-bold">Bavio-Ai-v1</span> · <span className="text-slate-600">27 Twilio usages · 0 false alarms</span>
            </div>
            <div className="pl-6">
              <span className="font-bold">Stripe Fixture</span> · <span className="text-slate-600">1 usage · Migration verified</span>
            </div>
            <div className="pl-6">
              <span className="font-bold text-emerald-700">Draft PR #1</span> · <span className="text-slate-600">Human review ready</span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            CARD 3: BENTO 1 — MINT CARD (#F2F9F5)
           ========================================================================= */}
        <section id="product" className="synth-card-mint p-8 md:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="font-mono text-xs uppercase tracking-widest text-emerald-800 flex items-center gap-2">
              <span>🤖</span>
              <span>AUTOMATION & IMPACT ANALYSIS</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#0F172A] leading-[1.12]">
              Built to simplify how modern engineering teams operate
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
              Empower your developers with intelligent AST impact analysis, real-time code tracing, and deterministic tools designed to eliminate false alarm noise.
            </p>

            <div className="pt-2">
              <Link href="/dashboard" className="btn-synth-black">
                <span>START NOW</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <ImpactArtwork />
          </div>

        </section>

        {/* =========================================================================
            CARD 4: EDITORIAL BANNER — DUAL-TONE PHRASE CONTRAST
           ========================================================================= */}
        <section className="synth-card p-12 md:p-20 text-center space-y-6 max-w-5xl mx-auto w-full">
          <div className="font-mono text-xs uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2">
            <span>📜</span>
            <span>PLATFORM CAPABILITIES</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-[52px] font-semibold tracking-tight leading-[1.18] max-w-4xl mx-auto">
            <span className="text-[#0F172A]">Powerful, deterministic AST platform designed to </span>
            <span className="text-slate-400">trace vendor changes 🔀 </span>
            <span className="text-[#0F172A]">verify impact 🛡️ </span>
            <span className="text-slate-400">and refactor code ⚡ </span>
            <span className="text-[#0F172A]">effortlessly.</span>
          </h2>
        </section>

        {/* =========================================================================
            CARD 5: BENTO 2 — LAVENDER CARD (#FAF5FF)
           ========================================================================= */}
        <section className="synth-card-lavender p-8 md:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-7 order-2 lg:order-1">
            <ZeroNoiseArtwork />
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
            <div className="font-mono text-xs uppercase tracking-widest text-purple-800 flex items-center gap-2">
              <span>📑</span>
              <span>ZERO-NOISE SHIELD</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#0F172A] leading-[1.12]">
              27 usages evaluated. <br /> Zero false alarms.
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
              When Twilio updated namespace casing in v2024, APIProof evaluated 27 repository call sites. Because none matched the affected signature, zero alerts were dispatched to PagerDuty.
            </p>

            <div className="pt-2">
              <Link href="/dashboard" className="btn-synth-black">
                <span>START NOW</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

        </section>

        {/* =========================================================================
            CARD 6: BENTO 3 — PINK CARD (#FFF5F8)
           ========================================================================= */}
        <section className="synth-card-pink p-8 md:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="font-mono text-xs uppercase tracking-widest text-rose-800 flex items-center gap-2">
              <span>⚡</span>
              <span>AUTOMATED REFACTORS</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#0F172A] leading-[1.12]">
              From breaking change to review-ready PR
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
              When an impact is confirmed, APIProof automatically generates refactored TypeScript migrations, executes repository typechecks, and drafts a human-reviewable GitHub Pull Request.
            </p>

            <div className="pt-2">
              <Link href="/dashboard" className="btn-synth-black">
                <span>START NOW</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <MigrationArtwork />
          </div>

        </section>

        {/* =========================================================================
            CARD 7: HOW IT WORKS TIMELINE
           ========================================================================= */}
        <section id="how-it-works" className="synth-card p-8 md:p-14 grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          <div className="lg:col-span-5 space-y-6">
            <div className="font-mono text-xs uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span>⚙️</span>
              <span>AUTOMATION WORKFLOW</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#0F172A] leading-[1.12]">
              Launch your API assistant in 5 steps
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
              Connect your repositories, observe vendor changes, and let APIProof handle continuous compatibility verification.
            </p>

            <div className="pt-2">
              <Link href="/dashboard" className="btn-synth-black">
                <span>TRY IT NOW</span>
                <span>↗</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {[
              { num: "01", title: "Observe vendor change", desc: "Monitors OpenAPI and Webhook updates across Stripe, Twilio, OpenAI, and custom providers." },
              { num: "02", title: "Trace repository usage", desc: "Parses TypeScript AST call sites to locate affected function signatures deterministically." },
              { num: "03", title: "Verify impact", desc: "Filters out false alarms. Only triggers if breaking parameters match active code." },
              { num: "04", title: "Prepare migration", desc: "Generates refactored code transformation patch with typecheck validation." },
              { num: "05", title: "Human review", desc: "Opens a safe GitHub Pull Request with AST diff breakdown for team approval." },
            ].map((step) => (
              <div key={step.num} className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E8E8E5] flex items-start gap-5 hover:bg-white hover:shadow-xs transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] tracking-tight">{step.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </section>

        {/* =========================================================================
            CARD 8: INTEGRATIONS CONSTELLATION
           ========================================================================= */}
        <section id="integrations" className="synth-card p-8 md:p-14 text-center space-y-8">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="font-mono text-xs uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2">
              <span>🔌</span>
              <span>INTEGRATION</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A]">
              Works with the tools you already use
            </h2>

            <p className="text-sm text-slate-600">
              Bring all your workflows together by integrating with the platforms your team relies on daily.
            </p>
          </div>

          <IntegrationsOrbit />
        </section>

        {/* =========================================================================
            CARD 9: HIGH-CONTRAST BLACK FRAME CTA CARD
           ========================================================================= */}
        <section className="synth-card-cta p-12 md:p-16 text-center space-y-6 max-w-4xl mx-auto w-full">
          <div className="font-mono text-xs uppercase tracking-widest text-slate-600 flex items-center justify-center gap-2">
            <span>✦</span>
            <span>NEXT-GENERATION API PLATFORM</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#0F172A]">
            Start Using Your API Compatibility Intelligence Today
          </h2>

          <p className="text-base text-slate-600 max-w-xl mx-auto">
            Zero setup fee. Read-only AST analysis. Connect your GitHub repository in under 2 minutes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/dashboard" className="btn-synth-black">
              <span>GET STARTED FREE</span>
              <span>↗</span>
            </Link>
            <Link href="/#contact" className="btn-synth-outline">
              <span>TALK TO SALES</span>
            </Link>
          </div>
        </section>

      </main>

      {/* GLOBAL FOOTER */}
      <LandingFooter />
    </div>
  );
}
