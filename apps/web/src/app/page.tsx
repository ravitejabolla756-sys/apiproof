import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { demoData } from "@/lib/demo-data";
import {
  ArrowRight,
  ShieldCheck,
  GitPullRequest,
  CheckCircle2,
  Lock,
  Cpu,
} from "lucide-react";

export default function LandingPage() {

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300 font-sans">
      <LandingNavbar />

      <main className="space-y-24 py-12 md:py-20">
        {/* SECTION 1: HERO */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            APIProof Core v1.0 Validated & Live
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-100 max-w-4xl mx-auto leading-[1.15]">
            Know when an API change <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              actually breaks your code.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            APIProof continuously monitors API/SDK change registries, maps deprecations directly to AST usages in your codebase, and prepares verified, review-only draft pull requests.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto gap-2 font-mono text-sm px-6 h-11">
                View Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 font-mono text-sm px-6 h-11 border-zinc-700">
                See How It Works
              </Button>
            </a>
          </div>

          {/* Quick proof badges */}
          <div className="pt-8 flex flex-wrap justify-center items-center gap-6 text-xs text-zinc-500 font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Zero Noise / AST Verified
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Read-Only Repositories
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Human Review Only PRs
            </div>
          </div>
        </section>

        {/* SECTION 2: PRODUCT PROOF SECTION (Stripe conceptual example) */}
        <section id="proof" className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-10">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
              Live Engine Proof
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              Real Impact Detection & Migration Output
            </h2>
            <p className="text-sm text-zinc-400 max-w-xl mx-auto">
              Empirically verified against real code: Stripe subscription coupon parameter deprecation.
            </p>
          </div>

          <Card className="border-zinc-800 bg-zinc-900/60 shadow-2xl overflow-hidden">
            {/* Header info bar */}
            <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-4">
                <Badge variant="destructive" className="uppercase text-[10px]">
                  Breaking Change
                </Badge>
                <span className="text-zinc-200 font-semibold">stripe-subscription-coupon-removed</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <span>Affected File: <strong className="text-emerald-400">src/billing.ts</strong></span>
                <span>Verification: <strong className="text-emerald-400">4/4 PASSED</strong></span>
              </div>
            </div>

            {/* Code Diff Display */}
            <div className="p-6 space-y-4 font-mono text-xs bg-zinc-950">
              <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-900 pb-2">
                <span>src/billing.ts (AST Usage Identified)</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> AST Matched & Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] leading-relaxed">
                {/* BEFORE */}
                <div className="rounded border border-rose-500/30 bg-rose-950/20 p-4 space-y-2">
                  <span className="text-rose-400 font-bold block text-xs border-b border-rose-500/20 pb-1">
                    BEFORE (Deprecated Stripe API)
                  </span>
                  <pre className="text-zinc-300 overflow-x-auto">
{`return stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
`}
                    <span className="bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-bold">
{`  coupon: couponId`}
                    </span>
{`
});`}
                  </pre>
                </div>

                {/* AFTER */}
                <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
                  <span className="text-emerald-400 font-bold block text-xs border-b border-emerald-500/20 pb-1">
                    AFTER (APIProof Verified Patch)
                  </span>
                  <pre className="text-zinc-300 overflow-x-auto">
{`return stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
`}
                    <span className="bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-bold">
{`  discounts: [{ coupon: couponId }]`}
                    </span>
{`
});`}
                  </pre>
                </div>
              </div>

              {/* Status Footer */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-400">Patch applied, typechecked, unit tested, and contract verified.</span>
                </div>
                <Badge variant="success" className="h-7 font-mono">
                  <GitPullRequest className="w-3.5 h-3.5 mr-1" />
                  Draft PR Created (#1)
                </Badge>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 3: HOW APIPROOF WORKS */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-12">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
              Engine Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              How APIProof Prevents Breaking Changes
            </h2>
            <p className="text-sm text-zinc-400 max-w-xl mx-auto">
              Four deterministic steps from vendor changelog to human-reviewed pull request.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-zinc-800 bg-zinc-900/40 relative">
              <CardHeader className="space-y-2">
                <span className="text-xs font-mono text-emerald-400 font-bold">01</span>
                <CardTitle className="text-sm font-mono text-zinc-100">
                  1. API Change Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 leading-relaxed">
                Reviewed intelligence registry tracks verified breaking changes, field removals, and type signature shifts.
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40 relative">
              <CardHeader className="space-y-2">
                <span className="text-xs font-mono text-emerald-400 font-bold">02</span>
                <CardTitle className="text-sm font-mono text-zinc-100">
                  2. Repository Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 leading-relaxed">
                AST parser scans repository usages to distinguish actual invocation points from unused dependency imports.
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40 relative">
              <CardHeader className="space-y-2">
                <span className="text-xs font-mono text-emerald-400 font-bold">03</span>
                <CardTitle className="text-sm font-mono text-zinc-100">
                  3. Verified Migration
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 leading-relaxed">
                Transforms source AST and executes local typechecks, unit tests, and contract checks before proposing changes.
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40 relative">
              <CardHeader className="space-y-2">
                <span className="text-xs font-mono text-emerald-400 font-bold">04</span>
                <CardTitle className="text-sm font-mono text-zinc-100">
                  4. Review-Only Draft PR
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 leading-relaxed">
                Creates an idempotent GitHub Draft PR. Never merges automatically; human review remains mandatory.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 4: API INVENTORY PREVIEW */}
        <section id="inventory" className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-10">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
              Supported Integrations
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              API & SDK Ecosystem Intelligence
            </h2>
            <p className="text-sm text-zinc-400 max-w-xl mx-auto">
              Clearly distinguishing mature reviewed intelligence from detected SDK dependencies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {demoData.providerRegistry.map((provider: { id: string; name: string; category: string; status: "REVIEWED" | "DETECTED" }) => (
              <div
                key={provider.id}
                className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="font-mono text-sm font-semibold text-zinc-200">
                    {provider.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {provider.category}
                  </div>
                </div>

                {provider.status === "REVIEWED" ? (
                  <Badge variant="success" className="text-[10px] font-mono">
                    REVIEWED INTELLIGENCE
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
                    DETECTED SDK
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: REAL REPOSITORY EXAMPLE (Bavio-Ai-v1) */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6">
          <Card className="border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-emerald-400 uppercase font-semibold">Real Repository Scan</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">ravitejabolla756-sys/Bavio-Ai-v1</span>
                </div>
                <h3 className="text-2xl font-bold font-mono text-zinc-100">
                  27 Twilio usages detected. Zero breaking changes matching current intelligence.
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  APIProof scanned 390 source files read-only in real repository Bavio-Ai-v1, classified Twilio API calls across routes and voice providers, and confirmed state as <strong>NOT_AFFECTED</strong>.
                </p>
              </div>

              <div className="w-full md:w-auto bg-zinc-950 p-4 rounded-md border border-zinc-800 space-y-3 font-mono text-xs min-w-[260px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Repository Status:</span>
                  <span className="text-emerald-400 font-bold">HEALTHY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Twilio Usages:</span>
                  <span className="text-zinc-200 font-bold">27 Locations</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Classification:</span>
                  <span className="text-zinc-200">NOT_AFFECTED</span>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <Link href="/dashboard/repositories/bavio-ai-v1">
                    <Button size="sm" variant="outline" className="w-full text-xs font-mono h-8 border-zinc-700">
                      View Bavio Analysis
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* SECTION 6: SECURITY / TRUST */}
        <section id="security" className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-10">
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
              Security Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 font-mono">
              Designed for Infrastructure Safety
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-lg bg-zinc-900/30 border border-zinc-800/80 space-y-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-semibold font-mono text-zinc-200">Read-Only Analysis</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Repository content is scanned in-memory without persistent code caching or write permissions during analysis.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-zinc-900/30 border border-zinc-800/80 space-y-2">
              <Lock className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-semibold font-mono text-zinc-200">Scoped Permissions</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                GitHub App operates with strict principle of least privilege, scoped to specific allowed repositories only.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-zinc-900/30 border border-zinc-800/80 space-y-2">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-semibold font-mono text-zinc-200">Human Review Required</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                All generated patches are created as GitHub Draft PRs. Engineers remain in complete control before merging.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-zinc-900/30 border border-zinc-800/80 space-y-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-semibold font-mono text-zinc-200">No Auto-Merge</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                APIProof strictly disables automatic branch merging or direct write operations to default branches.
              </p>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
