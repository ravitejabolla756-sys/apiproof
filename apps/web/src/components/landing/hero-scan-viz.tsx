"use client";

import React from "react";

export function HeroScanViz() {
  return (
    <div className="relative w-full aspect-[4/3.8] max-w-[620px] mx-auto flex items-center justify-center p-2 sm:p-4 select-none">
      {/* Layer 0: Multi-Stop Atmospheric Ambient Radial Glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-200/50 via-sky-200/40 to-emerald-200/50 blur-3xl opacity-80 pointer-events-none" />

      {/* Layer 1: Main Glass Sculpture Vessel */}
      <div className="relative w-full h-full rounded-[40px] bg-white/40 backdrop-blur-2xl border border-white/80 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
        {/* Fine geometric ambient grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

        {/* Layer 2: Main Change Propagation SVG Artwork */}
        <svg
          className="relative z-10 w-full h-full"
          viewBox="0 0 540 460"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Soft Glass Gradients */}
            <linearGradient id="vendorGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#F4F0FA" stopOpacity="0.7" />
            </linearGradient>

            <linearGradient id="affectedPath" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="50%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>

            <linearGradient id="safePath" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93C5FD" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>

            <linearGradient id="nodeGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#F6F6F4" stopOpacity="0.8" />
            </linearGradient>

            {/* Soft Glow Shadow */}
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* BACKGROUND GRAPH CURVES */}
          {/* Unaffected Flow Path 1 */}
          <path
            d="M 120 110 C 220 80, 300 140, 420 100"
            stroke="url(#safePath)"
            strokeWidth="3"
            strokeDasharray="4 4"
            opacity="0.6"
          />

          {/* Unaffected Flow Path 2 */}
          <path
            d="M 120 110 C 220 220, 310 380, 430 350"
            stroke="url(#safePath)"
            strokeWidth="3"
            strokeDasharray="4 4"
            opacity="0.5"
          />

          {/* ILLUMINATED AFFECTED PROPAGATION PATH */}
          <path
            d="M 120 110 C 240 120, 270 230, 410 220"
            stroke="url(#affectedPath)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#softGlow)"
          />
          <path
            d="M 120 110 C 240 120, 270 230, 410 220"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeDasharray="8 12"
            className="animate-[dash_15s_linear_infinite]"
          />

          {/* NODE 1: VENDOR ORIGIN (Glass Translucent Node) */}
          <g transform="translate(40, 60)" filter="url(#softGlow)">
            <rect
              width="150"
              height="100"
              rx="24"
              fill="url(#vendorGlass)"
              stroke="#E4D9F5"
              strokeWidth="2"
            />
            <circle cx="40" cy="40" r="16" fill="#F4F0FA" stroke="#C084FC" strokeWidth="2" />
            <path d="M 34 40 L 46 40 M 40 34 L 40 46" stroke="#9333EA" strokeWidth="2.5" strokeLinecap="round" />
            <text x="66" y="38" fill="#111111" fontSize="13" fontWeight="600" fontFamily="sans-serif">Stripe v17</text>
            <text x="66" y="54" fill="#686868" fontSize="11" fontFamily="sans-serif">API Change</text>

            <rect x="20" y="68" width="110" height="20" rx="10" fill="#FEF2F2" stroke="#FCA5A5" strokeWidth="1" />
            <text x="32" y="82" fill="#991B1B" fontSize="10" fontWeight="600" fontFamily="sans-serif">coupon removed</text>
          </g>

          {/* NODE 2: INTERMEDIATE AST SYMBOL NODE (Center Floating Glass) */}
          <g transform="translate(230, 160)" filter="url(#softGlow)">
            <rect
              width="140"
              height="80"
              rx="20"
              fill="url(#nodeGlass)"
              stroke="#E8E8E5"
              strokeWidth="2"
            />
            <circle cx="30" cy="40" r="12" fill="#EBF3FC" stroke="#60A5FA" strokeWidth="2" />
            <text x="50" y="36" fill="#111111" fontSize="11" fontWeight="600" fontFamily="monospace">subscriptions</text>
            <text x="50" y="50" fill="#3B82F6" fontSize="11" fontWeight="600" fontFamily="monospace">.create()</text>
          </g>

          {/* NODE 3: TARGET REPOSITORY SOURCE FILE (Right Glass Node - Affected Target) */}
          <g transform="translate(360, 180)" filter="url(#softGlow)">
            <rect
              width="160"
              height="110"
              rx="24"
              fill="#FFFFFF"
              stroke="#FCA5A5"
              strokeWidth="2.5"
            />
            <rect x="15" y="16" width="130" height="24" rx="12" fill="#FEF2F2" />
            <text x="28" y="32" fill="#991B1B" fontSize="11" fontWeight="600" fontFamily="monospace">src/billing.ts:42</text>

            <rect x="15" y="48" width="130" height="46" rx="10" fill="#111111" />
            <text x="25" y="66" fill="#F87171" fontSize="10" fontFamily="monospace">- coupon: id</text>
            <text x="25" y="82" fill="#34D399" fontSize="10" fontFamily="monospace">+ discounts: [...]</text>
          </g>

          {/* NODE 4: UNAFFECTED REPOSITORY NODE (Top Right Safe Glass Node) */}
          <g transform="translate(370, 40)" opacity="0.85">
            <rect width="130" height="60" rx="18" fill="url(#nodeGlass)" stroke="#D1EBE0" strokeWidth="2" />
            <circle cx="26" cy="30" r="10" fill="#EEF7F2" stroke="#10B981" strokeWidth="2" />
            <text x="44" y="28" fill="#111111" fontSize="11" fontWeight="600" fontFamily="sans-serif">Bavio-Ai-v1</text>
            <text x="44" y="42" fill="#047857" fontSize="10" fontWeight="600" fontFamily="sans-serif font-mono">0 Matches ✓</text>
          </g>
        </svg>

        {/* Subtle Bottom Refraction Bar */}
        <div className="relative z-10 flex items-center justify-between bg-white/80 rounded-2xl p-3 border border-white/90 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
            <span className="text-xs font-semibold text-[#111111]">AST Dependency Propagation Graph</span>
          </div>
          <span className="text-[11px] font-mono text-[#686868]">Live Trace Active</span>
        </div>
      </div>
    </div>
  );
}
