import React from "react";
import Link from "next/link";
import { MyOwlLogo } from "@/components/ui/logo";

export function LandingFooter() {
  return (
    <footer className="w-full bg-[#001033] text-slate-400 py-16 text-xs border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        {/* TOP ROW: Brand and Description */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-sm">
            <Link href="/" className="flex items-center gap-2.5 group">
              <MyOwlLogo className="h-6 w-auto transition-transform group-hover:scale-105" variant="light" />
              <span className="text-base font-semibold text-white tracking-wider uppercase">
                MY OWL
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              API change detection, migration planning, and safe draft pull requests.
            </p>
          </div>

          <Link href="/status" className="inline-flex min-h-10 items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white">
            <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden="true" />
            <span>Beta · Read-only safety boundary</span>
          </Link>
        </div>

        {/* DIVIDER */}
        <div className="border-t border-white/10" />

        {/* 3 COLUMNS OF SECONDARY NAVIGATION */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">

          {/* Column 1: PRODUCT */}
          <div className="space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
              Product
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <Link href="/features" className="hover:text-white transition-colors">
                  Product Overview
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-white transition-colors">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-white transition-colors">
                  Security Invariants
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: COMPANY */}
          <div className="space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
              Company
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <Link href="/docs" className="hover:text-white transition-colors">
                  Docs
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/updates" className="hover:text-white transition-colors">
                  Updates
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: INFORMATION */}
          <div className="space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
              Information
            </h4>
            <ul className="space-y-2.5 text-slate-400">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-white transition-colors">
                  Security
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-white transition-colors">
                  Cookies
                </Link>
              </li>
              <li>
                <Link href="/refunds" className="hover:text-white transition-colors">
                  Billing &amp; refunds
                </Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-white transition-colors">
                  Status
                </Link>
              </li>
              <li>
                <Link href="/404" className="hover:text-white transition-colors">
                  404
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* BOTTOM COPYRIGHT */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>© 2026 MY OWL. All rights reserved.</div>
          <div className="font-mono text-[11px] text-slate-400">myowl.dev</div>
        </div>

      </div>
    </footer>
  );
}
