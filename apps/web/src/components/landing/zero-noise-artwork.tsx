"use client";

import React from "react";

export function ZeroNoiseArtwork() {
  return (
    <div className="relative w-full aspect-[4/3] max-w-[580px] mx-auto flex items-center justify-center p-2 select-none">
      <div className="relative w-full h-full rounded-[28px] bg-white border border-[#F0E6FF] p-6 shadow-sm flex flex-col justify-between overflow-hidden">
        
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-[#F5EDFF] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-[0_0_8px_#9333EA]" />
            <span className="text-xs font-bold text-[#111111]">Zero-Noise Shield Visualizer</span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            0 MATCHES (27 CHECKED)
          </span>
        </div>

        {/* 27 Node Mesh Diagram */}
        <div className="relative w-full h-[240px] my-auto flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 500 240" fill="none">
            {/* Center Twilio Node */}
            <circle cx="250" cy="120" r="26" fill="#111111" />
            <circle cx="250" cy="120" r="6" fill="#A855F7" className="animate-pulse" />

            {/* 27 Radiating Call Site Traces */}
            {Array.from({ length: 27 }).map((_, i) => {
              const angle = (i * 360) / 27;
              const rad = (angle * Math.PI) / 180;
              const radius = 100 + (i % 3) * 12;
              const x = 250 + Math.cos(rad) * radius;
              const y = 120 + Math.sin(rad) * radius;

              return (
                <g key={i}>
                  <line
                    x1="250"
                    y1="120"
                    x2={x}
                    y2={y}
                    stroke="#E9D5FF"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <circle cx={x} cy={y} r="3" fill="#C084FC" opacity="0.7" />
                </g>
              );
            })}

            {/* Shield Ring */}
            <circle cx="250" cy="120" r="90" stroke="#C084FC" strokeWidth="2" strokeDasharray="6 4" fill="none" opacity="0.6" />
          </svg>

          {/* Center Overlay Tag */}
          <div className="relative z-10 text-center">
            <div className="inline-block px-3 py-1 rounded-full bg-white border border-[#E8E8E5] font-mono text-xs font-bold text-[#111111] shadow-xs">
              Twilio API v2024
            </div>
            <div className="font-mono text-[9px] text-[#686868] mt-1">27 Repos Scanned</div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between font-mono text-[10px] text-[#686868] pt-3 border-t border-[#F5EDFF]">
          <span>Bavio-Ai-v1 Repository Scan</span>
          <span className="text-purple-700 font-semibold">NO ALARM DISPATCHED</span>
        </div>
      </div>
    </div>
  );
}
