import { Boxes, ShieldCheck, CheckCircle2, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEMO_INVENTORY } from '@/lib/demo-data';

export const metadata = {
  title: 'API Inventory — APIProof',
  description: 'Indexed third-party SDKs and API change intelligence status',
};

export default function InventoryPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2333] pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-amber-400" />
            API & SDK Inventory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Third-party SDK integrations detected across connected repositories.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> 2 Reviewed Intelligence Engines
          </span>
        </div>
      </div>

      {/* Distinction Info Card */}
      <div className="bg-[#121624] border border-sky-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-sky-200">
        <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-zinc-100">Reviewed vs. Detected Intelligence Status</span>
          <p className="text-zinc-300 leading-relaxed">
            <strong className="text-emerald-400 font-mono">Reviewed:</strong> Official vendor breaking/deprecation records curated in APIProof change registry for impact matching.
            <br />
            <strong className="text-zinc-400 font-mono">Detected:</strong> Integration AST signatures recognized in project manifests and source files; change registry expanding.
          </p>
        </div>
      </div>

      {/* Inventory Table / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_INVENTORY.map((item) => (
          <Card key={item.id} className="p-5 space-y-4 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  {item.name}
                </h3>
                <span className="text-xs text-zinc-400 font-mono">{item.category}</span>
              </div>
              <Badge variant={item.status === 'reviewed' ? 'healthy' : 'neutral'}>
                {item.status === 'reviewed' ? 'Reviewed Intelligence' : 'Detected'}
              </Badge>
            </div>

            <div className="pt-2 border-t border-[#1f2333] space-y-2 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Monitoring Status</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 inline" /> Active Scan
                </span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Reviewed Change Rules</span>
                <span className="text-zinc-200 font-bold">
                  {item.rulesCount > 0 ? `${item.rulesCount} Rules` : 'In Pipeline'}
                </span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Repositories Found</span>
                <span className="text-zinc-200">
                  {item.id === 'stripe' ? 'apiproof-github-fixture' : item.id === 'twilio' ? 'Bavio-Ai-v1' : 'Bavio-Ai-v1'}
                </span>
              </div>
            </div>

            {item.status === 'reviewed' && (
              <div className="p-2.5 bg-[#0e121e] border border-emerald-500/20 rounded-lg text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                <span>Full Impact & Patch Engine</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
