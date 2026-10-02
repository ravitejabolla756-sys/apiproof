'use client';

import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface ProductVideoProps {
  videoId?: string;
  posterTitle?: string;
}

export function ProductVideo({
  videoId,
  posterTitle = "MY OWL End-to-End Migration Walkthrough"
}: ProductVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // If a YouTube videoId is provided and playing is active, show the iframe
  if (isPlaying && videoId) {
    return (
      <div className="relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={posterTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-[#00081C] shadow-2xl flex flex-col justify-between p-6 sm:p-10 select-none group">
      {/* Ambient background glow & grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/25 via-[#00081C] to-black opacity-90 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 pointer-events-none" />

      {/* Top Bar: Minimal Player Label & Status */}
      <div className="relative z-10 flex items-center justify-between font-mono text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-200 uppercase tracking-widest font-semibold">PRODUCT FILM</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-slate-500">
          <span>01:05 RUNTIME</span>
          <span>•</span>
          <span>1080P 60FPS</span>
        </div>
      </div>

      {/* Center: Play Trigger & Cinematic Badge */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4 my-auto">
        <button
          onClick={() => setIsPlaying(true)}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 hover:bg-[#D0F100] border border-white/20 hover:border-transparent backdrop-blur-md flex items-center justify-center text-white hover:text-black transition-all duration-300 group-hover:scale-105 shadow-2xl focus:outline-none"
          aria-label="Play product video"
        >
          <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current ml-1" />
        </button>

        <div className="space-y-1">
          <p className="font-serif text-xl sm:text-2xl text-white font-normal tracking-tight">
            See the deterministic migration engine in action.
          </p>
          <p className="text-xs sm:text-sm text-slate-400 font-sans max-w-md mx-auto">
            From upstream API deprecation to AST call-site isolation, verification, and a Draft PR.
          </p>
        </div>
      </div>

      {/* Bottom: Chapter Progression Strip */}
      <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px] text-slate-400">
        <span className="text-slate-300">0:00 Repo connect</span>
        <span className="text-slate-500 hidden sm:inline">→</span>
        <span className="text-slate-300">0:18 AST trace</span>
        <span className="text-slate-500 hidden sm:inline">→</span>
        <span className="text-slate-300">0:32 Exact patch</span>
        <span className="text-slate-500 hidden sm:inline">→</span>
        <span className="text-slate-300">0:40 4 Gates</span>
        <span className="text-slate-500 hidden sm:inline">→</span>
        <span className="text-emerald-400 font-semibold">0:55 Draft PR</span>
      </div>
    </div>
  );
}
