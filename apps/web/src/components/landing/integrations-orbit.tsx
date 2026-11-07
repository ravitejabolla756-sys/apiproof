"use client";

import React from "react";

const PROVIDERS = [
  { name: "Stripe", status: "AST Monitored", icon: "S", color: "bg-indigo-600" },
  { name: "Twilio", status: "AST Monitored", icon: "T", color: "bg-red-600" },
  { name: "OpenAI", status: "AST Monitored", icon: "O", color: "bg-emerald-600" },
  { name: "Supabase", status: "AST Monitored", icon: "S", color: "bg-green-600" },
  { name: "Groq", status: "AST Monitored", icon: "G", color: "bg-amber-600" },
  { name: "Deepgram", status: "AST Monitored", icon: "D", color: "bg-cyan-600" },
  { name: "ElevenLabs", status: "AST Monitored", icon: "E", color: "bg-blue-600" },
];

export function IntegrationsOrbit() {
  return (
    <div className="relative w-full h-[420px] max-w-[680px] mx-auto flex items-center justify-center select-none overflow-visible">
      {/* Outer Orbit SVG */}
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 680 420" fill="none">
        <circle cx="340" cy="210" r="160" stroke="#E8E8E5" strokeWidth="1.5" strokeDasharray="4 6" />
        <circle cx="340" cy="210" r="95" stroke="#D1D1D6" strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>

      {/* Central Core MY OWL Node */}
      <div className="relative z-20 w-28 h-28 rounded-3xl bg-[#111111] text-white shadow-xl flex flex-col items-center justify-center border border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 to-emerald-400 text-slate-950 font-bold text-base flex items-center justify-center mb-1">
          [·]
        </div>
        <div className="text-xs font-bold tracking-tight text-white">MY OWL</div>
        <div className="font-mono text-[8px] text-emerald-400 mt-0.5">AST Core</div>
      </div>

      {/* Orbiting Vendor Nodes */}
      {PROVIDERS.map((provider, idx) => {
        const angle = (idx * 360) / PROVIDERS.length - 90;
        const rad = (angle * Math.PI) / 180;
        const radius = 160;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;

        return (
          <div
            key={provider.name}
            className="absolute z-10 transition-transform duration-300 hover:scale-110"
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
          >
            <div className="px-3 py-2 rounded-2xl bg-white border border-[#E8E8E5] shadow-xs flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg ${provider.color} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                {provider.icon}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[#111111]">{provider.name}</div>
                <div className="font-mono text-[8px] text-emerald-700 font-medium">{provider.status}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
