import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased flex flex-col justify-between selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 sm:px-6 pt-36 pb-24 text-center my-auto outline-none">
        <div className="rounded-[32px] bg-[#EFF1F5] border border-black/[0.04] p-10 sm:p-16 shadow-xs space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <span>ERROR 404</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-6xl font-normal text-[#000E29] leading-tight">
            Page not found
          </h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            The page you are looking for doesn&apos;t exist, has been removed, or is temporarily unavailable.
          </p>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="btn-lime inline-flex min-h-11 items-center gap-2 text-xs font-semibold px-6 py-3 shadow-[0_0_24px_rgba(208,241,0,0.35)]"
            >
              <Home className="w-3.5 h-3.5 text-black" />
              <span>Return Home</span>
            </Link>
            <Link
              href="/features"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 border border-slate-200"
            >
              <span>Explore Features</span>
            </Link>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
