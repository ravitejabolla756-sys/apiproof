import Link from "next/link";
import { Terminal } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950 text-zinc-400 font-mono text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <span className="text-zinc-200 font-bold">APIProof</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">Continuous API Breaking Change Prevention</span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-zinc-500">
          <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">
            Dashboard
          </Link>
          <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">
            How it works
          </a>
          <a href="https://github.com/ravitejabolla756-sys/apiproof" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">
            GitHub Repo
          </a>
          <span className="cursor-not-allowed hover:text-zinc-500">Security</span>
          <span className="cursor-not-allowed hover:text-zinc-500">Privacy</span>
          <span className="cursor-not-allowed hover:text-zinc-500">Terms</span>
        </div>

        <div className="text-zinc-600 text-[11px]">
          &copy; {new Date().getFullYear()} APIProof Engine. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
