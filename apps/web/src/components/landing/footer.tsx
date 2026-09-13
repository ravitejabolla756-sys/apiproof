import Link from "next/link";
import { ApiProofLogo } from "@/components/ui/logo";

export function LandingFooter() {
  return (
    <footer className="bg-[#111111] text-white py-16 md:py-24 font-sans border-t border-zinc-800">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-zinc-800">
          {/* LEFT 4 Columns: Brand */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <ApiProofLogo className="w-5 h-5 filter invert brightness-200" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">
                APIProof
              </span>
            </Link>
            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              API compatibility intelligence for engineering teams. Trace vendor SDK breaking changes directly to repository usage.
            </p>
          </div>

          {/* RIGHT 8 Columns: Link Columns */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Product
              </h4>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li><Link href="/#product" className="hover:text-white transition-colors">Overview</Link></li>
                <li><Link href="/#integrations" className="hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/#security" className="hover:text-white transition-colors">Security Architecture</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard Demo</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Resources
              </h4>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li><Link href="/blog" className="hover:text-white transition-colors">Change Intelligence</Link></li>
                <li><a href="https://github.com/ravitejabolla756-sys/apiproof" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub Repository</a></li>
                <li><Link href="/#how-it-works" className="hover:text-white transition-colors">Verification Process</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Company
              </h4>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Legal
              </h4>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li><span className="text-zinc-500 cursor-not-allowed">Privacy Policy</span></li>
                <li><span className="text-zinc-500 cursor-not-allowed">Terms of Service</span></li>
                <li><span className="text-zinc-500 cursor-not-allowed">Security Policy</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* BOTTOM STRIP */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <div>
            &copy; {new Date().getFullYear()} APIProof Inc. Verified API compatibility intelligence.
          </div>
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Read-only AST analysis engine
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
