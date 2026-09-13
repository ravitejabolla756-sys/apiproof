import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  GitBranch,
  FileCode,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/20 selection:text-blue-200">
      <LandingNavbar />

      <main className="space-y-24 py-12 md:py-20">
        {/* SECTION 1: ASYMMETRIC 2-COLUMN HERO */}
        <section id="product" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* LEFT 45% */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                API compatibility intelligence
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-100 leading-[1.15]">
                Know when an API change affects your code.
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-sans max-w-xl">
                APIProof maps vendor SDK changes to real repository usage, verifies the impact, and prepares safe migration pull requests.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="md" className="w-full sm:w-auto gap-2">
                    Connect GitHub
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="md" variant="outline" className="w-full sm:w-auto">
                    View product
                  </Button>
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-sans">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" /> Read-only analysis by default
                </span>
                <span className="text-zinc-700">·</span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Human review before every merge
                </span>
              </div>
            </div>

            {/* RIGHT 55%: REALISTIC PRODUCT FINDING PANEL */}
            <div className="lg:col-span-7">
              <div className="rounded-lg bg-zinc-900/90 border border-zinc-800 p-5 shadow-sm space-y-4 font-sans">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-semibold text-zinc-200">Stripe</span>
                    <span className="text-xs text-zinc-500">·</span>
                    <span className="text-xs text-zinc-400">Subscription coupon parameter removed</span>
                  </div>
                  <StatusPill status="verified" label="Migration verified" />
                </div>

                {/* Impact details */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded bg-zinc-950/80 border border-zinc-800/60 space-y-1">
                    <div className="text-zinc-500 text-[11px]">Repository</div>
                    <div className="font-mono text-zinc-200 text-xs truncate">payments-service</div>
                  </div>
                  <div className="p-3 rounded bg-zinc-950/80 border border-zinc-800/60 space-y-1">
                    <div className="text-zinc-500 text-[11px]">Affected file</div>
                    <div className="font-mono text-zinc-200 text-xs truncate">src/billing.ts</div>
                  </div>
                  <div className="p-3 rounded bg-zinc-950/80 border border-zinc-800/60 space-y-1">
                    <div className="text-zinc-500 text-[11px]">Verification</div>
                    <div className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 4/4 passed
                    </div>
                  </div>
                </div>

                {/* Evidence Traversal */}
                <div className="p-3.5 rounded bg-zinc-950/90 border border-zinc-800/80 space-y-2 text-xs">
                  <div className="text-[11px] text-zinc-400 font-medium">Impact evidence trace</div>
                  <div className="font-mono text-[11px] text-zinc-300 space-y-1 bg-zinc-900/60 p-2.5 rounded border border-zinc-800/40">
                    <div className="text-amber-300">subscriptions.create(...)</div>
                    <div className="text-zinc-500 pl-3">↓ coupon property detected at src/billing.ts:4</div>
                    <div className="text-emerald-300 pl-3">✓ Refactored to discounts property parameter</div>
                  </div>
                </div>

                {/* Draft PR Footer */}
                <div className="flex items-center justify-between pt-1 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-blue-400" />
                    <span>Draft Pull Request #1 created</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">Human review required</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: WORKFLOW & PRODUCT EVIDENCE */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-900 pt-16">
          <div className="space-y-4 mb-10">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Trusted engineering workflow
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              API change → repository usage → verified impact → safe migration
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="text-xs font-semibold text-blue-400">1. Observe</div>
              <h3 className="text-sm font-semibold text-zinc-200">Vendor Changes</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tracks documented breaking changes and deprecations across third-party SDKs.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="text-xs font-semibold text-blue-400">2. Match</div>
              <h3 className="text-sm font-semibold text-zinc-200">Repository Usage</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Maps SDK symbol calls directly to your source files to locate actual API calls.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="text-xs font-semibold text-blue-400">3. Prove</div>
              <h3 className="text-sm font-semibold text-zinc-200">Verified Impact</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Determines whether repository code is affected or unaffected with evidence.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="text-xs font-semibold text-blue-400">4. Migrate</div>
              <h3 className="text-sm font-semibold text-zinc-200">Safe Migration</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Generates verified AST patches and creates review-only GitHub draft pull requests.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: API ECOSYSTEM STRIP */}
        <section id="ecosystem" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-900 pt-16">
          <div className="space-y-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              API & SDK Ecosystem
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Supported vendor APIs and recognized integrations.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-6">
            <div>
              <div className="text-xs font-medium text-zinc-400 mb-3">Reviewed intelligence</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded bg-blue-950/40 border border-blue-800/50 text-blue-300 text-xs font-medium">
                  Stripe (Payments)
                </span>
                <span className="px-3 py-1 rounded bg-blue-950/40 border border-blue-800/50 text-blue-300 text-xs font-medium">
                  Twilio (Communication)
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-800/60 pt-4">
              <div className="text-xs font-medium text-zinc-400 mb-3">Detected integrations</div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">OpenAI</span>
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">Supabase</span>
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">Groq</span>
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">Deepgram</span>
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">ElevenLabs</span>
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">Sarvam</span>
                <span className="px-3 py-1 rounded bg-zinc-950 border border-zinc-800">Dodo Payments</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: SECURITY & TRUST ARCHITECTURE */}
        <section id="security" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-900 pt-16">
          <div className="space-y-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Security Architecture
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Designed for strict repository safety and engineering control.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Read-only analysis by default
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Repository scanning is read-only and ephemeral with no persistent code storage.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" /> GitHub App repository scoping
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Access is restricted strictly to explicitly authorized organization repositories.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-400" /> Migration branch isolation
              </div>
              <p className="text-zinc-400 leading-relaxed">
                All proposed migrations are created on isolated dedicated feature branches.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-400" /> No direct writes to main branch
              </div>
              <p className="text-zinc-400 leading-relaxed">
                APIProof never commits directly to default branches under any circumstances.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" /> No automatic merge
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Automated merging is disabled. Pull requests must be reviewed and merged by engineers.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" /> Evidence-bound verification
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Every patch undergoes 4-point verification (typecheck, tests, contract invariants).
              </p>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
