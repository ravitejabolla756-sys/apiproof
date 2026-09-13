import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950 text-zinc-400 font-sans text-xs py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <ShieldCheck className="w-3 h-3 text-blue-400" />
          </div>
          <span className="text-zinc-200 font-semibold">APIProof</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-500">API compatibility intelligence</span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-zinc-500">
          <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">
            Dashboard
          </Link>
          <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">
            How it works
          </a>
          <a href="#security" className="hover:text-zinc-300 transition-colors">
            Security
          </a>
          <a href="https://github.com/ravitejabolla756-sys/apiproof" target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">
            GitHub
          </a>
        </div>

        <div className="text-zinc-600 text-[11px]">
          &copy; {new Date().getFullYear()} APIProof. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
