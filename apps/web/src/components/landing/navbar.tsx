'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { MyOwlLogo } from "@/components/ui/logo";

// Desktop navbar links: Product, How it works, Security, Docs, Pricing
const DESKTOP_NAV_LINKS = [
  { label: "Product", href: "/features" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Security", href: "/security" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

// Mobile menu links: Product, How it works, Security, Docs, Pricing
const MOBILE_NAV_LINKS = [
  { label: "Product", href: "/features" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Security", href: "/security" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function LandingNavbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-[760px] pointer-events-none transition-all duration-300">
      <a href="#main-content" className="skip-link pointer-events-auto">Skip to main content</a>
      <header className="pointer-events-auto w-full">
        {/* Main Navbar Bar (Quieter when scrolling) */}
        <div className={`px-3.5 sm:px-5 rounded-full border flex items-center justify-between transition-all duration-300 ${
          isScrolled
            ? "h-[50px] sm:h-[52px] bg-[#071328]/70 backdrop-blur-xl border-white/[0.08] shadow-md scale-[0.98]"
            : "h-[54px] sm:h-[56px] bg-[#071328]/85 backdrop-blur-md border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.18)] scale-100"
        }`}>

          {/* LEFT: Geometric Developer Logo & Brand Wordmark (No background box) */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 group shrink-0 focus:outline-hidden"
            aria-label="MY OWL Home"
          >
            <MyOwlLogo className="h-5 sm:h-6 w-auto transition-transform group-hover:scale-105" variant="light" />
            <span className="text-xs sm:text-sm font-semibold tracking-wider text-white uppercase select-none">
              MY OWL
            </span>
          </Link>

          {/* CENTER: Desktop Navigation (Features, How it works, Pricing) */}
          <nav aria-label="Primary site navigation" className="hidden md:flex items-center gap-1 text-[13px] font-medium">
            {DESKTOP_NAV_LINKS.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-full transition-colors ${
                    active
                      ? "text-white bg-white/10 font-medium"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Primary Action (Get Started) */}
          <div className="hidden md:flex items-center shrink-0">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                prefetch={true}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <Link
                href="/login"
                prefetch={true}
                className="px-4 py-1.5 bg-[#D0F100] hover:bg-[#bce000] text-black text-xs font-semibold rounded-full transition-all shadow-xs hover:shadow-[0_0_16px_rgba(208,241,0,0.35)] active:scale-95"
              >
                Get Started
              </Link>
            )}
          </div>

          {/* MOBILE TOGGLE (< 768px / mobile only) */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors focus:outline-hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-site-navigation"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4 text-white" />
              ) : (
                <Menu className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

        </div>

        {/* MOBILE OVERLAY SHEET */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-[-1] bg-black/50 backdrop-blur-xs md:hidden pointer-events-auto"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div id="mobile-site-navigation" className="md:hidden mt-2 p-4 rounded-[20px] bg-[#071328]/95 backdrop-blur-xl border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-top-2 duration-200">
              <nav aria-label="Mobile site navigation" className="flex flex-col gap-1">
                {MOBILE_NAV_LINKS.map((link) => {
                  const active = isLinkActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "text-white bg-white/10"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="h-px bg-white/10 my-3" />

              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 px-4 rounded-xl bg-[#D0F100] hover:bg-[#bce000] text-black text-sm font-semibold transition-colors shadow-xs"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </header>
    </div>
  );
}
