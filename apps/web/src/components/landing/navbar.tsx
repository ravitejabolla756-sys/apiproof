import Link from "next/link";
import { Github, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-sans group">
          <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            APIProof
          </span>
        </Link>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-sans font-medium text-zinc-400">
          <a href="#product" className="hover:text-zinc-100 transition-colors">
            Product
          </a>
          <a href="#how-it-works" className="hover:text-zinc-100 transition-colors">
            How it works
          </a>
          <a href="#security" className="hover:text-zinc-100 transition-colors">
            Security
          </a>
          <a href="#ecosystem" className="hover:text-zinc-100 transition-colors">
            Docs
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ravitejabolla756-sys/apiproof"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-sans text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <Link href="/dashboard" className="text-xs font-sans text-zinc-400 hover:text-zinc-100 transition-colors hidden sm:block">
            Sign in
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="gap-1.5 text-xs">
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
