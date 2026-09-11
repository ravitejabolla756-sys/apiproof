import Link from "next/link";
import { Terminal, Github, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 font-mono group">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-zinc-950 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Terminal className="w-5 h-5 font-bold" />
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-100">
            API<span className="text-emerald-400">Proof</span>
          </span>
        </Link>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono text-zinc-400">
          <a href="#how-it-works" className="hover:text-zinc-100 transition-colors">
            How it works
          </a>
          <a href="#proof" className="hover:text-zinc-100 transition-colors">
            Proof & Demo
          </a>
          <a href="#inventory" className="hover:text-zinc-100 transition-colors">
            Supported APIs
          </a>
          <a href="#security" className="hover:text-zinc-100 transition-colors">
            Security
          </a>
          <span className="text-zinc-600 cursor-not-allowed">
            Pricing <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">Soon</span>
          </span>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/ravitejabolla756-sys/apiproof"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors font-mono mr-2"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <Link href="/dashboard">
            <Button size="sm" className="gap-1.5 text-xs font-mono">
              View Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
