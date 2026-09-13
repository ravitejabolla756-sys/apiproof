import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { HeroScanViz } from "@/components/landing/hero-scan-viz";
import { ProofTerminal } from "@/components/landing/proof-terminal";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { demoData } from "@/lib/demo-data";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Cpu,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300 font-sans">
      <LandingNavbar />

      <main className="space-y-24 py-12 md:py-20">
        {/* SECTION 1: ASYMMETRIC HERO */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* LEFT 50% / 6 cols */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                APIProof Change Intelligence
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-100 leading-[1.1]">
                Know which API changes{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
                  actually affect your code.
                </span>
              </h1>

              <p className="text-base text-zinc-400 leading-relaxed font-sans max-w-xl">
                APIProof continuously maps vendor API/SDK deprecations to exact AST symbol usages in your repository, proves the impact, and prepares verified, review-only draft pull requests.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto gap-2 font-mono text-xs h-11 px-6 font-bold">
                    Explore Live Demo
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto font-mono text-xs h-11 px-6 border-zinc-800 text-zinc-300">
                    See Architecture
                  </Button>
                </a>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-zinc-500 font-mono border-t border-zinc-900">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Read-Only Scans
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> AST Verified
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Human Review Only
                </span>
              </div>
            </div>

            {/* RIGHT 50% / 6 cols: Animated Product Visualization */}
            <div className="lg:col-span-6">
              <HeroScanViz />
            </div>
          </div>
        </section>

        {/* SECTION 2: LIVE PROOF TERMINAL */}
        <section id="proof" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest font-bold">
              Live Verification Evidence
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              Deterministic Traversal & Proof Terminal
            </h2>
          </div>

          <ProofTerminal />
        </section>

        {/* SECTION 3: CONNECTED PIPELINE PRODUCT STORY */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest font-bold">
              Engine Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              From Vendor Changelog to Review-Only Draft PR
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs">
              <span className="text-emerald-400 font-bold">01. OBSERVE</span>
              <h3 className="font-bold text-zinc-100 text-sm font-sans">Vendor Changes</h3>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Reviewed change intelligence tracks verified breaking changes & deprecations.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs">
              <span className="text-sky-400 font-bold">02. MATCH</span>
              <h3 className="font-bold text-zinc-100 text-sm font-sans">AST Repositories</h3>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                AST parser scans symbol call points to distinguish real usage from unused imports.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs">
              <span className="text-teal-300 font-bold">03. PROVE</span>
              <h3 className="font-bold text-zinc-100 text-sm font-sans">Zero Noise Evidence</h3>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Classifies repository as NOT_AFFECTED or generates precise evidence trace.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs">
              <span className="text-amber-400 font-bold">04. MIGRATE</span>
              <h3 className="font-bold text-zinc-100 text-sm font-sans">Verified AST Patch</h3>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Applies patch locally and runs 4 verification gates (tsc build, unit tests, contracts).
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs">
              <span className="text-cyan-300 font-bold">05. REVIEW</span>
              <h3 className="font-bold text-zinc-100 text-sm font-sans">GitHub Draft PR</h3>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Creates an idempotent Draft PR. Never auto-merges; human review is mandatory.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: PROVIDER ECOSYSTEM */}
        <section id="inventory" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest font-bold">
              API & SDK Ecosystem
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              Reviewed Intelligence vs. Recognized Integrations
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {demoData.providerRegistry.map((provider: { id: string; name: string; category: string; status: "REVIEWED" | "DETECTED" }) => (
              <div
                key={provider.id}
                className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
                  provider.status === "REVIEWED"
                    ? "bg-teal-500/10 border-teal-500/30 text-teal-200"
                    : "bg-zinc-950 border-zinc-800/80 text-zinc-300"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-zinc-100">{provider.name}</div>
                  <div className="text-[10px] text-zinc-500">{provider.category}</div>
                </div>

                <StatusPill
                  status={provider.status === "REVIEWED" ? "reviewed" : "detected"}
                  label={provider.status}
                />
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: SECURITY / TRUST ARCHITECTURE */}
        <section id="security" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-8">
            <div className="text-center space-y-2">
              <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest font-bold">
                Security Architecture
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100 font-mono">
                Developer Infrastructure Trust Guarantees
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs">
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-zinc-100">Read-Only Analysis</h3>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Source code is evaluated ephemerally during AST scanning with zero persistent code caching.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2">
                <Lock className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-zinc-100">Scoped Permissions</h3>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  GitHub App operates strictly on explicit user-selected repositories with minimum scopes.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-zinc-100">Human Review Only</h3>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Migrations are delivered strictly as Draft PRs. Engineers retain full manual merge authority.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-zinc-100">No Auto-Merge</h3>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  APIProof strictly disables automatic branch merging or direct write operations to default branches.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
