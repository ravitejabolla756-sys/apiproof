import Link from "next/link";
import { ApiProofLogo } from "@/components/ui/logo";
import { Github, Twitter, Linkedin } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="w-full pt-8 pb-12">
      <div className="max-w-[1380px] mx-auto px-4 md:px-8">
        
        {/* SynthAI 1:1 Black Footer Card */}
        <div className="synth-card-footer p-10 md:p-16 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Column 1: Brand Info */}
            <div className="md:col-span-5 space-y-5">
              <Link href="/" className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-white text-slate-950 flex items-center justify-center font-bold overflow-hidden">
                  <ApiProofLogo className="w-5 h-5 text-slate-950" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                  MY OWL
                </span>
              </Link>

              <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                Continuous API compatibility intelligence for TypeScript repositories. Detects breaking SDK changes, verifies impact deterministically, and prepares safe PRs.
              </p>

              <div className="flex items-center gap-3 text-slate-400 pt-2">
                <a href="https://github.com/ravitejabolla756-sys/apiproof" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white hover:border-slate-700 transition-colors">
                  <Github className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white hover:border-slate-700 transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:text-white hover:border-slate-700 transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 2: Main Pages */}
            <div className="md:col-span-3 space-y-4 font-mono text-xs uppercase tracking-wider">
              <div className="text-white font-bold text-sm">Product</div>
              <ul className="space-y-2.5 text-slate-400">
                <li><Link href="/#product" className="hover:text-white transition-colors">Impact Analysis</Link></li>
                <li><Link href="/#security" className="hover:text-white transition-colors">Zero-Noise Shield</Link></li>
                <li><Link href="/#how-it-works" className="hover:text-white transition-colors">Refactor Engine</Link></li>
                <li><Link href="/#integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              </ul>
            </div>

            {/* Column 3: Inner Pages */}
            <div className="md:col-span-2 space-y-4 font-mono text-xs uppercase tracking-wider">
              <div className="text-white font-bold text-sm">Resources</div>
              <ul className="space-y-2.5 text-slate-400">
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Changelog</Link></li>
              </ul>
            </div>

            {/* Column 4: Legal Pages */}
            <div className="md:col-span-2 space-y-4 font-mono text-xs uppercase tracking-wider">
              <div className="text-white font-bold text-sm">Legal</div>
              <ul className="space-y-2.5 text-slate-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security Policy</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-500">
            <div>© {new Date().getFullYear()} MY OWL. All Rights Reserved.</div>
            <div>Built for mission-critical developer infrastructure.</div>
          </div>

        </div>

      </div>
    </footer>
  );
}
