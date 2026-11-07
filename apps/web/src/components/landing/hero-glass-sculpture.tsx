'use client';

import React from 'react';

export function HeroGlassSculpture() {
  return (
    <div className="relative w-full h-[480px] md:h-[540px] lg:h-[580px] flex items-center justify-center overflow-visible select-none">
      {/* Soft Multi-Layered Iridescent Glow Field */}
      <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-cyan-300/30 via-purple-300/30 to-rose-200/40 rounded-full blur-3xl animate-iridescence pointer-events-none" />

      {/* Main 3D Iridescent Glass Prism Sculpture Canvas */}
      <div className="relative w-full max-w-[620px] h-full flex items-center justify-center animate-float-glass">
        
        {/* SVG Multi-Layered Glass Petal & Refraction Render */}
        <svg aria-hidden="true" className="w-full h-full overflow-visible drop-shadow-[0_25px_50px_rgba(120,119,198,0.18)]" viewBox="0 0 600 600" fill="none">
          <defs>
            {/* Iridescent Gradient Filters */}
            <linearGradient id="glass-petal-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#E0F2FE" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#F3E8FF" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#D1FAE5" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id="glass-petal-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#E0E7FF" stopOpacity="0.85" />
              <stop offset="80%" stopColor="#FCE7F3" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.85" />
            </linearGradient>

            <linearGradient id="rim-specular" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
            </linearGradient>

            {/* Backdrop Caustic Refraction Filter */}
            <filter id="glass-refraction" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feBlend in="SourceGraphic" in2="goo" />
            </filter>
          </defs>

          {/* 8-Petal 3D Glass Star/Flower Sculpture Geometry (Matching SynthAI Reference) */}
          <g transform="translate(300, 300)">
            {Array.from({ length: 8 }).map((_, i) => {
              const rot = i * 45;
              return (
                <g key={i} transform={`rotate(${rot})`}>
                  {/* Outer Glass Petal */}
                  <path
                    d="M 0 0 C -45 -90, -35 -220, 0 -250 C 35 -220, 45 -90, 0 0 Z"
                    fill={i % 2 === 0 ? "url(#glass-petal-1)" : "url(#glass-petal-2)"}
                    stroke="url(#rim-specular)"
                    strokeWidth="2.5"
                    opacity="0.85"
                  />
                  {/* Inner Specular Highlight Ribbon */}
                  <path
                    d="M 0 -30 C -20 -100, -15 -180, 0 -210 C 15 -180, 20 -100, 0 -30 Z"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                </g>
              );
            })}

            {/* Center 3D Glass Prism Core */}
            <circle r="60" fill="url(#glass-petal-1)" stroke="#FFFFFF" strokeWidth="3" opacity="0.95" />
            <circle r="40" fill="none" stroke="#38BDF8" strokeWidth="2" opacity="0.7" />
            
            {/* Illuminated Center Symbol */}
            <path
              d="M -15 -15 L 15 15 M 15 -15 L -15 15 M 0 -20 L 0 20 M -20 0 L 20 0"
              stroke="#0284C7"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </g>

          {/* Floating Glass Specular Spheres around Sculpture */}
          <circle cx="120" cy="140" r="16" fill="url(#glass-petal-1)" stroke="#FFFFFF" strokeWidth="2" opacity="0.9" />
          <circle cx="500" cy="180" r="22" fill="url(#glass-petal-2)" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" />
          <circle cx="480" cy="460" r="18" fill="url(#glass-petal-1)" stroke="#FFFFFF" strokeWidth="2" opacity="0.9" />
        </svg>

        {/* Floating Code Intelligence Glass Badge Overlay */}
        <div className="absolute left-[20px] bottom-[40px] px-5 py-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-white shadow-[0_16px_32px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10B981]" />
          <div>
            <div className="text-xs font-bold text-[#111111] tracking-tight">API Compatibility Core</div>
            <div className="font-mono text-[10px] text-[#686868]">Deterministic AST Refraction</div>
          </div>
        </div>

      </div>
    </div>
  );
}
