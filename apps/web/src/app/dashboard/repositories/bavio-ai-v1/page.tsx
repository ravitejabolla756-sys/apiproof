import Link from 'next/link';
import {
  ShieldCheck,
  PhoneCall,
  CheckCircle2,
  Code2,
  FileCode2,
  Boxes,
  ChevronLeft,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEMO_BAVIO_TWILIO_USAGES } from '@/lib/demo-data';

export const metadata = {
  title: 'Bavio-Ai-v1 — APIProof Repository Analysis',
  description: 'APIProof observe-only analysis results for Bavio-Ai-v1',
};

export default function BavioRepoDetailPage() {
  const bavioProviders = [
    { name: 'Twilio', detail: '27 Usages • SDK ^5.12.2', status: 'reviewed', icon: PhoneCall, iconColor: 'text-amber-400' },
    { name: 'OpenAI', detail: 'LLM & Embeddings', status: 'detected', icon: Boxes, iconColor: 'text-emerald-400' },
    { name: 'Supabase', detail: 'Database & Auth', status: 'detected', icon: Boxes, iconColor: 'text-emerald-400' },
    { name: 'Groq', detail: 'LPU Inference', status: 'detected', icon: Boxes, iconColor: 'text-sky-400' },
    { name: 'Dodo Payments', detail: 'Billing Integration', status: 'detected', icon: Boxes, iconColor: 'text-purple-400' },
    { name: 'Deepgram', detail: 'Audio Transcription', status: 'detected', icon: Boxes, iconColor: 'text-rose-400' },
    { name: 'ElevenLabs', detail: 'Voice Generation', status: 'detected', icon: Boxes, iconColor: 'text-indigo-400' },
    { name: 'Sarvam AI', detail: 'Multilingual Voice', status: 'detected', icon: Boxes, iconColor: 'text-amber-400' },
    { name: 'Redis', detail: 'Caching & Queues', status: 'detected', icon: Boxes, iconColor: 'text-red-400' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Back Link */}
      <Link
        href="/dashboard/repositories"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Repositories
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1f2333] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-zinc-100">Bavio-Ai-v1</h1>
            <Badge variant="healthy">Healthy / Not Affected</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2 font-mono">
            <span>Owner: <strong className="text-zinc-200">ravitejabolla756-sys</strong></span>
            <span>•</span>
            <span>Repo ID: <strong className="text-zinc-200">1260141355</strong></span>
            <span>•</span>
            <span>Branch: <strong className="text-zinc-200">main</strong> (SHA <code className="text-sky-400">934b5829</code>)</span>
            <span>•</span>
            <span>Files Analyzed: <strong className="text-zinc-200">390</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="h-4 w-4" />
          <span>Observe Mode Active</span>
        </div>
      </div>

      {/* Section B: Scan Summary Banner */}
      <Card className="bg-[#0f1422] border-emerald-500/30 p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Repository Scan Successful — NOT_AFFECTED
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              APIProof scanned 390 files in <code className="text-sky-300">Bavio-Ai-v1</code> and indexed 27 Twilio SDK usages. Tested against reviewed Twilio rules (<code className="text-zinc-300 font-mono">twilio-twiml-namespace-casing</code> and <code className="text-zinc-300 font-mono">twilio-programmable-fax-removed</code>). Bavio uses modern Twilio SDK v5.12.2 syntax and is <strong>NOT AFFECTED</strong>.
            </p>
          </div>
        </div>
      </Card>

      {/* Section A: API Inventory */}
      <div className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>
            <Boxes className="h-4 w-4 text-amber-400" />
            Section A: Detected API & SDK Inventory (9)
          </CardTitle>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {bavioProviders.map((prov) => {
            const Icon = prov.icon;
            return (
              <div
                key={prov.name}
                className="bg-[#12141c] border border-[#1f2333] rounded-lg p-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-md bg-[#171a26] border border-[#222738] flex items-center justify-center ${prov.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">{prov.name}</div>
                    <div className="text-[11px] font-mono text-zinc-500">{prov.detail}</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    prov.status === 'reviewed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                  }`}
                >
                  {prov.status === 'reviewed' ? 'Reviewed' : 'Detected'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section C: Twilio Usage Evidence */}
      <div className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>
            <Code2 className="h-4 w-4 text-sky-400" />
            Section C: Indexed Twilio SDK Usages (27 Found)
          </CardTitle>
          <span className="text-xs font-mono text-zinc-400">Representative AST bindings</span>
        </CardHeader>

        <div className="space-y-3">
          {DEMO_BAVIO_TWILIO_USAGES.map((usg) => (
            <Card key={usg.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-sky-300 font-semibold flex items-center gap-1.5">
                  <FileCode2 className="h-3.5 w-3.5 text-sky-400" /> {usg.file}:{usg.line}
                </span>
                <span className="bg-zinc-800 text-zinc-300 border border-zinc-700/60 px-2 py-0.5 rounded font-mono text-[11px]">
                  {usg.context}
                </span>
              </div>
              <div className="text-xs text-zinc-300 font-mono">
                Symbol: <span className="text-amber-300 font-bold">{usg.symbol}</span>
              </div>
              <pre className="bg-[#090a0f] border border-[#1b1f2e] rounded-lg p-3 text-[11px] text-zinc-300 font-mono overflow-x-auto">
                <code>{usg.codeSnippet}</code>
              </pre>
            </Card>
          ))}
        </div>
      </div>

      {/* Section D: Findings Empty State */}
      <div className="space-y-4">
        <CardHeader className="mb-0">
          <CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Section D: Open Findings
          </CardTitle>
        </CardHeader>

        <Card className="p-8 text-center space-y-3 bg-[#0d0f17] border-dashed border-zinc-800">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-200">No Current Reviewed API Changes Affect This Repository</h4>
          <p className="text-xs text-zinc-400 max-w-xl mx-auto leading-relaxed">
            APIProof confirmed 27 active Twilio SDK usages in <code className="text-zinc-300">Bavio-Ai-v1</code>. Tested against officially documented breaking changes (<code className="text-zinc-300">twilio-twiml-namespace-casing</code> and <code className="text-zinc-300">twilio-programmable-fax-removed</code>). No matching breaking syntax was found.
          </p>
          <div className="pt-2">
            <Badge variant="healthy" className="px-3 py-1">Classification: NOT_AFFECTED</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
