import {
  AlertTriangle,
  FileCode2,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from "lucide-react";

export function ProofTerminal() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-6 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Live Change Intelligence Terminal</h3>
            <p className="text-[11px] text-zinc-500">
              Deterministic AST tracing from vendor changelog to evidence-backed human review
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 font-semibold">
          LIVE DEMO EVIDENCE
        </span>
      </div>

      {/* Three Panel Composition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PANEL 1: LEFT - Vendor Change */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-amber-400 font-bold uppercase tracking-wider">
              1. Vendor Intelligence
            </span>
            <span className="text-zinc-500">Stripe API</span>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 space-y-1.5 text-xs">
            <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              stripe-subscription-coupon-removed
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Top-level <code className="text-amber-300">coupon</code> parameter removed from{" "}
              <code className="text-zinc-300">subscriptions.create()</code>.
            </p>
            <div className="text-[10px] text-zinc-500 font-mono pt-1">
              Target Version: <span className="text-zinc-300">v17.0.0+</span>
            </div>
          </div>
        </div>

        {/* PANEL 2: CENTER - Repository Impact Graph */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-sky-400 font-bold uppercase tracking-wider">
              2. AST Impact Traversal
            </span>
            <span className="text-zinc-500">apiproof-github-fixture</span>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 space-y-2 text-xs text-zinc-300">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">SDK Import</span>
              <span className="font-mono text-zinc-200">stripe</span>
            </div>
            <div className="flex items-center justify-center text-zinc-600">↓</div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Invoked Symbol</span>
              <span className="font-mono text-amber-300">subscriptions.create</span>
            </div>
            <div className="flex items-center justify-center text-zinc-600">↓</div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Source File</span>
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <FileCode2 className="w-3 h-3" /> src/billing.ts
              </span>
            </div>
          </div>
        </div>

        {/* PANEL 3: RIGHT - Compatibility Proof */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold uppercase tracking-wider">
              3. Compatibility Proof
            </span>
            <span className="text-zinc-500">Read-only beta</span>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Classification</span>
              <span className="font-bold text-rose-400">AFFECTED / 1 FILE</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Evidence Status</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> REVIEWED RULE
              </span>
            </div>
            <div className="pt-1.5 border-t border-zinc-900 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Repository Action</span>
              <span className="font-bold text-cyan-300 flex items-center gap-1">
                None — detection only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Guarantee */}
      <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Read-only beta — reviewed evidence is shown for your engineering team to evaluate.</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-bold uppercase">Human Review Mandatory</span>
      </div>
    </div>
  );
}
