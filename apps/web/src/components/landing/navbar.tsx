import Link from "next/link";
import { Github, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiProofLogo } from "@/components/ui/logo";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-[#E8E8E5]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between font-sans">
        {/* LEFT: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-stone-100 border border-[#E8E8E5] flex items-center justify-center transition-transform group-hover:scale-105">
            <ApiProofLogo className="w-5 h-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-[#111111]">
            APIProof
          </span>
        </Link>

        {/* CENTER: Clean Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold uppercase tracking-wider text-[#686868]">
          <Link href="/#product" className="hover:text-[#111111] transition-colors">
            PRODUCT
          </Link>
          <Link href="/#how-it-works" className="hover:text-[#111111] transition-colors">
            HOW IT WORKS
          </Link>
          <Link href="/#integrations" className="hover:text-[#111111] transition-colors">
            INTEGRATIONS
          </Link>
          <Link href="/pricing" className="hover:text-[#111111] transition-colors">
            PRICING
          </Link>
          <Link href="/about" className="hover:text-[#111111] transition-colors">
            ABOUT
          </Link>
          <Link href="/blog" className="hover:text-[#111111] transition-colors">
            BLOG
          </Link>
          <Link href="/contact" className="hover:text-[#111111] transition-colors">
            CONTACT
          </Link>
        </nav>

        {/* RIGHT: Action CTAs */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/ravitejabolla756-sys/apiproof"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#686868] hover:text-[#111111] transition-colors px-2 py-1"
          >
            <Github className="w-4 h-4 text-[#111111]" />
            <span>GitHub</span>
          </a>

          <Link href="/dashboard" className="hidden sm:inline-block text-xs font-medium text-[#686868] hover:text-[#111111] transition-colors px-2 py-1">
            SIGN IN
          </Link>

          <Link href="/dashboard">
            <Button size="sm" variant="primary" className="text-xs px-4 py-2 font-medium">
              <span>GET STARTED</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
