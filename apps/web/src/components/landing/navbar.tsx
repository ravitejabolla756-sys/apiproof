'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Github, LayoutDashboard } from "lucide-react";
import { ApiProofLogo } from "@/components/ui/logo";

export function LandingNavbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="w-full pt-4 pb-2 z-50 relative">
      <div className="max-w-[1380px] mx-auto px-4 md:px-8 flex items-center justify-between">
        
        {/* LEFT: Logo & Wordmark */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-white border border-[#E8E8E5] flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs overflow-hidden">
            <ApiProofLogo className="w-5 h-5 text-[#0F172A]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#0F172A]">
            MY OWL
          </span>
        </Link>

        {/* RIGHT: Floating White Pill Navigation Container (1:1 SynthAI Live Spec) */}
        <nav className="synth-pill-nav px-6 py-2 flex items-center gap-6">
          <Link
            href="/#product"
            className="font-mono text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors"
          >
            PRODUCT
          </Link>
          <Link
            href="/#integrations"
            className="font-mono text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors hidden sm:inline-block"
          >
            INTEGRATIONS
          </Link>
          <Link
            href="/#security"
            className="font-mono text-xs font-medium uppercase tracking-wider text-[#686868] hover:text-[#0F172A] transition-colors hidden md:inline-block"
          >
            SECURITY
          </Link>
          <Link
            href="/#how-it-works"
            className="font-mono text-xs font-medium uppercase tracking-wider text-[#686868] hover:text-[#0F172A] transition-colors hidden lg:inline-block"
          >
            DOCS
          </Link>
          <a
            href="https://github.com/ravitejabolla756-sys/apiproof"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors hidden sm:inline-flex items-center gap-1.5"
          >
            <Github className="w-3.5 h-3.5 text-[#0F172A]" />
            <span>GitHub</span>
          </a>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              prefetch={true}
              className="px-4 py-2 bg-[#0F172A] text-white font-mono text-xs font-medium uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors ml-1 flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>DASHBOARD</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                prefetch={true}
                className="font-mono text-xs font-medium uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors hidden sm:inline-block"
              >
                SIGN IN
              </Link>

              {/* SynthAI CTA Button (rounded-lg font-mono uppercase) */}
              <Link
                href="/login"
                prefetch={true}
                className="px-4 py-2 bg-[#0F172A] text-white font-mono text-xs font-medium uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors ml-1"
              >
                <span>GET STARTED</span>
              </Link>
            </>
          )}
        </nav>

      </div>
    </header>
  );
}
