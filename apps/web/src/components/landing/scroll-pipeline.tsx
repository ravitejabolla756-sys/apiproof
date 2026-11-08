'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileCode, GitPullRequest } from 'lucide-react';

interface StageData {
  number: string;
  tag: string;
  headlinePart1: string;
  headlinePart2: string;
  copy: string;
}

const STAGES: StageData[] = [
  {
    number: '01',
    tag: 'DETECTS CHANGES',
    headlinePart1: 'One upstream',
    headlinePart2: 'change.',
    copy: 'MY OWL detects breaking changes in your dependencies and finds exactly where they impact your code.',
  },
  {
    number: '02',
    tag: 'TRACES IMPACT',
    headlinePart1: 'Finds every',
    headlinePart2: 'affected place.',
    copy: 'It traces the change through your codebase using AST analysis, so nothing is missed.',
  },
  {
    number: '03',
    tag: 'PLANS MIGRATION',
    headlinePart1: 'Plans the smallest',
    headlinePart2: 'safe migration.',
    copy: 'MY OWL maps the upstream change to the affected call site and proposes the smallest deterministic code transformation.',
  },
  {
    number: '04',
    tag: 'VERIFIES & OPENS PR',
    headlinePart1: 'Verifies the migration',
    headlinePart2: 'before it reaches review.',
    copy: 'Four deterministic verification gates run before MY OWL opens a Draft PR.',
  },
];

export function ScrollPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDotRef = useRef<HTMLDivElement>(null);
  const mobileActiveDotRef = useRef<HTMLDivElement>(null);
  const desktopSpineAuraRef = useRef<HTMLDivElement>(null);
  const mobileSpineAuraRef = useRef<HTMLDivElement>(null);
  const statusTextRef = useRef<HTMLSpanElement>(null);

  const rawProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const activeStepRef = useRef(0);

  const [activeStep, setActiveStep] = useState(0);
  const [step4Progress, setStep4Progress] = useState(0);

  useEffect(() => {
    let rafId: number;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;

      if (totalScrollable <= 0) return;

      const rawProgress = -rect.top / totalScrollable;
      rawProgressRef.current = Math.max(0, Math.min(1, rawProgress));
    };

    const LERP_FACTOR = 0.07;

    const getInterpolatedStagePosition = (p: number): number => {
      // Smooth cubic Hermite interpolation between stage anchors (0, 1, 2, 3)
      const smoothstep = (min: number, max: number, val: number) => {
        const x = Math.max(0, Math.min(1, (val - min) / (max - min)));
        return x * x * (3 - 2 * x);
      };

      if (p <= 0.18) return 0;
      if (p < 0.28) return 0 + smoothstep(0.18, 0.28, p);
      if (p <= 0.43) return 1;
      if (p < 0.53) return 1 + smoothstep(0.43, 0.53, p);
      if (p <= 0.68) return 2;
      if (p < 0.78) return 2 + smoothstep(0.68, 0.78, p);
      return 3;
    };

    const tick = () => {
      const prev = smoothProgressRef.current;
      const target = rawProgressRef.current;
      const diff = target - prev;

      if (Math.abs(diff) > 0.0001) {
        smoothProgressRef.current = prev + diff * LERP_FACTOR;
      } else {
        smoothProgressRef.current = target;
      }

      const currentSmooth = smoothProgressRef.current;
      const stagePos = getInterpolatedStagePosition(currentSmooth);

      // Direct DOM update for smooth floating active dot (Desktop)
      // Track is h-[300px], buttons are 16px tall (centers at 8px, 102.67px, 197.33px, 292px)
      // Distance between center of button 0 (8px) and button 3 (292px) is 284px
      if (activeDotRef.current) {
        const topPx = 8 + (stagePos / 3) * 284;
        activeDotRef.current.style.top = `${topPx}px`;
        if (desktopSpineAuraRef.current) {
          desktopSpineAuraRef.current.style.top = `${topPx}px`;
        }
      }

      // Direct DOM update for smooth floating active dot (Mobile)
      if (mobileActiveDotRef.current) {
        const mobilePct = (stagePos / 3) * 100;
        mobileActiveDotRef.current.style.left = `${mobilePct}%`;
        if (mobileSpineAuraRef.current) {
          mobileSpineAuraRef.current.style.left = `${mobilePct}%`;
        }
      }

      // Direct DOM update for bottom anchor status text
      if (statusTextRef.current) {
        if (currentSmooth >= 0.98) {
          statusTextRef.current.textContent = 'Story complete · Continue scrolling';
        } else {
          const currentStage = (STAGES[activeStepRef.current] ?? STAGES[0]) as StageData;
          statusTextRef.current.textContent = `${currentStage.number} / 04 — ${currentStage.tag}`;
        }
      }

      // Discrete step boundary trigger (4 stages over track)
      const nextStep = Math.min(3, Math.floor(currentSmooth * 4));
      if (nextStep !== activeStepRef.current) {
        activeStepRef.current = nextStep;
        setActiveStep(nextStep);
      }

      // Sub-progress for step 4 verification gate sequential animation
      if (nextStep === 3) {
        const s4 = Math.max(0, Math.min(1, (currentSmooth - 0.75) / 0.25));
        setStep4Progress(s4);
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const scrollToStep = (index: number) => {
    if (!containerRef.current) return;
    const containerTop = window.scrollY + containerRef.current.getBoundingClientRect().top;
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    const targetOffset = containerTop + ((index + 0.1) / 4) * totalScrollable;
    window.scrollTo({ top: targetOffset, behavior: 'smooth' });
  };

  // Step 4 verification gate sequential animation states
  const gateAstPassed = activeStep === 3 && step4Progress >= 0.12;
  const gateTsPassed = activeStep === 3 && step4Progress >= 0.32;
  const gateScopePassed = activeStep === 3 && step4Progress >= 0.52;
  const gateTestPassed = activeStep === 3 && step4Progress >= 0.72;
  const allPassed = gateAstPassed && gateTsPassed && gateScopePassed && gateTestPassed;
  const prReady = activeStep === 3 && step4Progress >= 0.86;

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-[#FFFFFF]"
      style={{ height: '600vh' }}
      aria-label="MY OWL Four-Stage Pipeline Story"
    >
      {/* ========================================================================= */}
      <div className="sticky top-0 h-screen w-full overflow-y-auto lg:overflow-hidden bg-[#FFFFFF] flex flex-col justify-between selection:bg-[#004EE8]/10 selection:text-[#000E29]">
        {/* ======================================================================= */}
        {/* MAIN EDITORIAL CONTENT: LEFT STORY | CENTRAL SPINE | RIGHT TECHNICAL    */}
        {/* ======================================================================= */}
        <div className="relative z-20 max-w-7xl w-full mx-auto px-5 sm:px-8 lg:px-12 flex-1 flex flex-col justify-center pt-16 sm:pt-20 pb-2">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_40px_1.15fr] items-start gap-6 lg:gap-10">
            {/* ------------------------------------------------------------------- */}
            {/* LEFT SIDE: Narrative / Story Explanation (Stacked Panels)           */}
            {/* ------------------------------------------------------------------- */}
            <div className="relative min-h-[380px] sm:min-h-[420px] lg:min-h-[460px]">
              {STAGES.map((stage, idx) => {
                const isCurrent = activeStep === idx;
                return (
                  <div
                    key={stage.number}
                    aria-hidden={!isCurrent}
                    className={`absolute inset-0 space-y-4 sm:space-y-6 lg:pr-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isCurrent
                        ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                        : idx < activeStep
                        ? 'opacity-0 -translate-y-2 pointer-events-none z-0'
                        : 'opacity-0 translate-y-2 pointer-events-none z-0'
                    }`}
                  >
                    {/* Pipeline Section Header */}
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono tracking-widest text-[#004EE8] uppercase font-bold">
                      <span>MY OWL PIPELINE</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-600">AST TRACING ENGINE</span>
                    </div>

                    {/* Mono Stage Label with Thin Connector Rule */}
                    <div className="flex items-center gap-3 font-mono text-[11px] tracking-wider text-slate-600">
                      <span className="font-semibold text-slate-600">{stage.number}</span>
                      <span className="w-8 sm:w-12 h-px bg-slate-200" />
                      <span className="font-bold text-slate-600 uppercase tracking-widest text-[10px]">
                        {stage.tag}
                      </span>
                    </div>

                    {/* Large Serif Headline */}
                    <h2 className="font-serif text-2xl sm:text-4xl lg:text-[3.25rem] text-[#000E29] font-normal leading-[1.1] tracking-tight">
                      <span>{stage.headlinePart1}</span>
                      <br />
                      <span className="italic font-normal">{stage.headlinePart2}</span>
                    </h2>

                    {/* Supporting Copy */}
                    <p className="text-xs sm:text-base text-slate-600 font-sans leading-relaxed max-w-md">
                      {stage.copy}
                    </p>

                    {/* Stage-specific Understated Technical Identity */}
                    <div className="pt-1 sm:pt-2">
                      {idx === 0 && (
                        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
                          {/* Stripe S Icon Badge */}
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#635BFF] flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-xs shrink-0 select-none">
                            S
                          </div>
                          <div>
                            <div className="font-bold text-[#000E29] text-xs sm:text-sm font-sans">
                              Stripe Node SDK
                            </div>
                            <div className="text-slate-600 text-[10px] sm:text-[11px] font-mono">
                              v17.4 → v18.0
                            </div>
                          </div>
                          <div className="w-px h-7 sm:h-8 bg-slate-200 mx-0.5 sm:mx-1" />
                          <div className="space-y-0.5">
                            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-rose-600 font-bold">
                              BREAKING CHANGE
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-600 font-sans line-clamp-1 sm:line-clamp-none">
                              subscription discount parameter changed
                            </div>
                          </div>
                        </div>
                      )}

                      {idx === 1 && (
                        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                            AST
                          </div>
                          <div>
                            <div className="font-bold text-[#000E29] text-xs sm:text-sm font-sans">
                              ts-morph Resolver
                            </div>
                            <div className="text-slate-600 text-[10px] sm:text-[11px] font-mono">
                              Read-only AST Traversal
                            </div>
                          </div>
                          <div className="w-px h-7 sm:h-8 bg-slate-200 mx-0.5 sm:mx-1" />
                          <div className="space-y-0.5">
                            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-800 font-bold">
                              1 CALL SITE REACHED
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-600 font-sans">
                              26 safe invocations filtered out
                            </div>
                          </div>
                        </div>
                      )}

                      {idx === 2 && (
                        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                            ±
                          </div>
                          <div>
                            <div className="font-bold text-[#000E29] text-xs sm:text-sm font-sans">
                              Unified AST Patch
                            </div>
                            <div className="text-slate-600 text-[10px] sm:text-[11px] font-mono">
                              1 insertion, 1 deletion
                            </div>
                          </div>
                          <div className="w-px h-7 sm:h-8 bg-slate-200 mx-0.5 sm:mx-1" />
                          <div className="space-y-0.5">
                            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-blue-700 font-bold">
                              ZERO AUTO-MERGE
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-600 font-sans">
                              Preserves indentation &amp; style
                            </div>
                          </div>
                        </div>
                      )}

                      {idx === 3 && (
                        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                            ✓
                          </div>
                          <div>
                            <div className="font-bold text-[#000E29] text-xs sm:text-sm font-sans">
                              4-Gate Compiler Harness
                            </div>
                            <div className="text-slate-600 text-[10px] sm:text-[11px] font-mono">
                              Pre-flight Verification
                            </div>
                          </div>
                          <div className="w-px h-7 sm:h-8 bg-slate-200 mx-0.5 sm:mx-1" />
                          <div className="space-y-0.5">
                            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-800 font-bold">
                              DRAFT PR #142
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-600 font-sans">
                              Isolated branch ready for review
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* MOBILE & TABLET: Stage Indicator Nodes (Soft Fading Spine)          */}
            {/* ------------------------------------------------------------------- */}
            <div className="flex lg:hidden items-center justify-center py-3 select-none">
              <div className="relative flex items-center justify-between w-56 px-2">
                {/* 1. Soft Ambient Horizontal Spine */}
                <div
                  className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[1.5px] pointer-events-none z-0 rounded-full"
                  style={{
                    background:
                      'linear-gradient(to right, transparent 0%, rgba(148, 163, 184, 0.12) 15%, rgba(148, 163, 184, 0.22) 50%, rgba(148, 163, 184, 0.12) 85%, transparent 100%)',
                    filter: 'blur(0.5px)',
                  }}
                />

                {/* 2. Soft Blue Active Spine Aura (follows active dot) */}
                <div
                  ref={mobileSpineAuraRef}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-[3px] rounded-full pointer-events-none z-0 will-change-[left]"
                  style={{
                    left: '0%',
                    background:
                      'linear-gradient(to right, transparent 0%, rgba(0, 78, 232, 0.08) 25%, rgba(0, 78, 232, 0.25) 50%, rgba(0, 78, 232, 0.08) 75%, transparent 100%)',
                    filter: 'blur(1px)',
                  }}
                />

                {/* 3. Smooth Floating Active Dot */}
                <div
                  ref={mobileActiveDotRef}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#004EE8] ring-3 ring-[#004EE8]/20 pointer-events-none z-20 will-change-[left]"
                  style={{ left: '0%' }}
                />

                {/* 4. Four Static Dots */}
                {STAGES.map((s, idx) => (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => scrollToStep(idx)}
                    className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-2 z-10"
                    aria-label={`Jump to stage ${s.number}: ${s.tag}`}
                    aria-pressed={activeStep === idx}
                  >
                    <div className="w-2 h-2 rounded-full bg-white border border-slate-300" />
                    <span
                      className={`text-[10px] font-mono transition-colors ${
                        activeStep === idx ? 'font-bold text-[#004EE8]' : 'text-slate-600'
                      }`}
                    >
                      {s.number}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* DESKTOP CENTER: Soft Fading Spine with 4 Stage Indicator Nodes      */}
            {/* ------------------------------------------------------------------- */}
            <div className="hidden lg:flex flex-col items-center justify-center relative h-[360px] select-none">
              <div className="relative w-8 h-[300px] flex flex-col justify-between items-center">
                {/* 1. Soft Ambient Vertical Spine (fades to transparent at top & bottom) */}
                <div
                  className="absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-[1.5px] pointer-events-none z-0 rounded-full"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent 0%, rgba(148, 163, 184, 0.12) 15%, rgba(148, 163, 184, 0.22) 50%, rgba(148, 163, 184, 0.12) 85%, transparent 100%)',
                    filter: 'blur(0.5px)',
                  }}
                />

                {/* 2. Soft Blue Active Spine Aura (illuminates the spine softly around active dot) */}
                <div
                  ref={desktopSpineAuraRef}
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-28 rounded-full pointer-events-none z-0 will-change-[top]"
                  style={{
                    top: '8px',
                    background:
                      'linear-gradient(to bottom, transparent 0%, rgba(0, 78, 232, 0.08) 25%, rgba(0, 78, 232, 0.25) 50%, rgba(0, 78, 232, 0.08) 75%, transparent 100%)',
                    filter: 'blur(1px)',
                  }}
                />

                {/* 3. Smooth Floating Active Blue Glowing Dot (crisp & prominent at z-20) */}
                <div
                  ref={activeDotRef}
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#004EE8] ring-4 ring-[#004EE8]/25 shadow-sm pointer-events-none z-20 will-change-[top]"
                  style={{ top: '8px' }}
                />

                {/* 4. Four Static Stage Nodes (z-10 above spine) */}
                {STAGES.map((s, idx) => (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => scrollToStep(idx)}
                    className="group relative flex min-h-11 min-w-11 items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-2 z-10"
                    aria-label={`Jump to stage ${s.number}: ${s.tag}`}
                    aria-pressed={activeStep === idx}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 group-hover:border-slate-500 transition-colors" />

                    {/* Hover Tooltip showing stage number */}
                    <span className="absolute left-8 font-mono text-[10px] font-semibold text-slate-600 group-hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {s.number} {s.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* RIGHT SIDE: Live Technical Visualization (Stacked Panels)           */}
            {/* NO BIG BOXED CARD. Natural typography, thin rules, whitespace.      */}
            {/* ------------------------------------------------------------------- */}
            <div className="relative min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] lg:pl-4 font-mono">
              {/* ================================================================= */}
              {/* STAGE 01 VISUALIZATION: Exact Upstream Code Transformation        */}
              {/* ================================================================= */}
              <div
                aria-hidden={activeStep !== 0}
                inert={activeStep !== 0}
                className={`absolute inset-0 space-y-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  activeStep === 0
                    ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                    : activeStep > 0
                    ? 'opacity-0 -translate-y-2 pointer-events-none z-0'
                    : 'opacity-0 translate-y-2 pointer-events-none z-0'
                }`}
              >
                {/* File & Transform Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/90 text-xs">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-slate-700" />
                    <span className="font-bold text-[#000E29] text-sm">src/billing.ts</span>
                  </div>
                  <span className="text-slate-600 text-xs tracking-wider">AST Transform</span>
                </div>

                {/* Code Snippet with Diff Lines */}
                <div
                  role="region"
                  aria-label="Code transformation example"
                  tabIndex={0}
                  className="text-[11px] sm:text-xs leading-[1.7] sm:leading-[1.8] space-y-0.5 text-slate-700 overflow-x-auto font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004EE8] focus-visible:ring-offset-2"
                >
                  <div className="flex gap-2 sm:gap-4 whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">40</span>
                    <span>
                      <span className="text-blue-700">export async function</span>{' '}
                      <span className="text-slate-900 font-semibold">createSubscription</span>
                      (customerId: string) &#123;
                    </span>
                  </div>

                  <div className="flex gap-2 sm:gap-4 whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">41</span>
                    <span className="pl-3 sm:pl-4">
                      <span className="text-blue-700">return await</span> stripe.subscriptions.create(&#123;
                    </span>
                  </div>

                  <div className="flex gap-2 sm:gap-4 whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">42</span>
                    <span className="pl-6 sm:pl-8 text-slate-600">customer: customerId,</span>
                  </div>

                  {/* Removed Line */}
                  <div className="flex gap-2 sm:gap-4 bg-rose-50/80 -mx-2 sm:-mx-3 px-2 sm:px-3 py-0.5 rounded whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">43</span>
                    <span className="pl-6 sm:pl-8 text-rose-700 font-medium">
                      - coupon: promoCouponId,
                    </span>
                  </div>

                  {/* Added Line */}
                  <div className="flex gap-2 sm:gap-4 bg-emerald-50/80 -mx-2 sm:-mx-3 px-2 sm:px-3 py-0.5 rounded whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">44</span>
                    <span className="pl-6 sm:pl-8 text-emerald-800 font-medium">
                      + discounts: [&#123; coupon: promoCouponId &#125;],
                    </span>
                  </div>

                  <div className="flex gap-2 sm:gap-4 whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">45</span>
                    <span className="pl-6 sm:pl-8 text-slate-600">items: [&#123; price: priceId &#125;],</span>
                  </div>

                  <div className="flex gap-2 sm:gap-4 whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">46</span>
                    <span className="pl-3 sm:pl-4">&#125;);</span>
                  </div>

                  <div className="flex gap-2 sm:gap-4 whitespace-nowrap">
                    <span className="text-slate-600 w-5 sm:w-6 text-right select-none shrink-0">47</span>
                    <span>&#125;</span>
                  </div>
                </div>

                {/* Understated Verification Row & Verified Pill */}
                <div className="pt-2.5 sm:pt-3 border-t border-slate-200/90 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-slate-600 text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> AST Syntax
                    </span>
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> TypeScript
                    </span>
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Call-site Scope
                    </span>
                    <span className="flex items-center gap-1 sm:gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Dry-run Tests
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-[11px] font-bold">
                    <span>✓</span>
                    <span>VERIFIED</span>
                  </div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* STAGE 02 VISUALIZATION: AST Tracing Flow                          */}
              {/* ================================================================= */}
              <div
                aria-hidden={activeStep !== 1}
                className={`absolute inset-0 space-y-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  activeStep === 1
                    ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                    : activeStep > 1
                    ? 'opacity-0 -translate-y-2 pointer-events-none z-0'
                    : 'opacity-0 translate-y-2 pointer-events-none z-0'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/90 text-xs">
                  <div>
                    <div className="font-bold text-[#000E29] text-sm">src/billing.ts</div>
                    <div className="text-slate-600 text-[11px]">Line 42</div>
                  </div>
                  <span className="text-slate-600 text-xs bg-slate-100 px-2 py-0.5 rounded">
                    AST Node: CallExpression
                  </span>
                </div>

                {/* The Flow Diagram */}
                <div className="py-2 space-y-0 text-xs divide-y divide-slate-100">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-rose-700 font-semibold font-mono">coupon: promoCouponId</span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">Target param</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <span className="font-semibold text-[#000E29] font-mono">stripe.subscriptions.create()</span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">Method alias</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <span className="font-bold text-amber-800 font-mono">src/billing.ts:42</span>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">AFFECTED</span>
                  </div>
                </div>

                {/* Understated Metadata */}
                <div className="pt-2 border-t border-slate-200/90 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold text-[#000E29]">1 affected call site</span>
                  <span>26 unrelated instances excluded</span>
                </div>

                {/* Verification Criteria Rows */}
                <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                  <div className="flex items-center justify-between py-0.5">
                    <span>AST Symbol Traversal</span>
                    <span className="text-emerald-600 font-bold">✓</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span>Reachability Proof</span>
                    <span className="text-emerald-600 font-bold">✓</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span>False-Positive Exclusion</span>
                    <span className="text-emerald-600 font-bold">✓</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span>Scope Isolation</span>
                    <span className="text-emerald-600 font-bold">✓</span>
                  </div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* STAGE 03 VISUALIZATION: Migration Plan                            */}
              {/* ================================================================= */}
              <div
                aria-hidden={activeStep !== 2}
                className={`absolute inset-0 space-y-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  activeStep === 2
                    ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                    : activeStep > 2
                    ? 'opacity-0 -translate-y-2 pointer-events-none z-0'
                    : 'opacity-0 translate-y-2 pointer-events-none z-0'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/90 text-xs">
                  <div className="font-bold text-slate-600 tracking-wider text-[11px] uppercase">
                    MIGRATION PLAN
                  </div>
                  <div className="font-semibold text-[#000E29]">src/billing.ts:42</div>
                </div>

                {/* BEFORE / AFTER Minimal Diff Display */}
                <div className="space-y-0 divide-y divide-slate-100">
                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 pt-0.5 shrink-0 w-12">BEFORE</div>
                    <div className="text-rose-700 font-mono text-xs leading-relaxed bg-rose-50/60 px-2 py-1 flex-1">
                      coupon: promoCouponId
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 pt-0.5 shrink-0 w-12">AFTER</div>
                    <div className="text-emerald-800 font-mono font-medium text-xs leading-relaxed bg-emerald-50/60 px-2 py-1 flex-1">
                      discounts: [&#123; coupon: promoCouponId &#125;]
                    </div>
                  </div>
                </div>

                {/* Metadata Stats */}
                <div className="pt-1 border-t border-slate-100 flex items-center gap-5 text-xs font-mono text-slate-600">
                  <span><span className="font-bold text-slate-800">1</span> file</span>
                  <span><span className="font-bold text-slate-800">1</span> call site</span>
                  <span><span className="font-bold text-slate-800">1</span> patch</span>
            <span><span className="font-bold text-emerald-800">0</span> unrelated</span>
                </div>

                {/* Branch & Safety Policy */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-600">
                  <div>
                    Branch:{' '}
                    <span className="font-semibold text-slate-800">
                      apiproof/stripe-v18-update
                    </span>
                  </div>
                  <div className="text-emerald-800 font-semibold">Zero auto-merge</div>
                </div>
              </div>

              {/* ================================================================= */}
              {/* STAGE 04 VISUALIZATION: Exact Verification & Draft PR Ready       */}
              {/* ================================================================= */}
              <div
                aria-hidden={activeStep !== 3}
                className={`absolute inset-0 space-y-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  activeStep === 3
                    ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                    : 'opacity-0 translate-y-2 pointer-events-none z-0'
                }`}
              >
                {/* Header: VERIFICATION · 4 / 4 PASSED */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/90 text-xs">
                  <div className="font-bold text-[#000E29] tracking-wider text-[11px] uppercase">
                    VERIFICATION
                  </div>
                  <div
                    className={`font-bold transition-colors duration-300 ${
                      allPassed ? 'text-emerald-800' : 'text-slate-600'
                    }`}
                  >
                    {allPassed ? '4 / 4 PASSED' : 'VERIFYING GATES...'}
                  </div>
                </div>

                {/* Four Horizontal Rows */}
                <div className="space-y-0 divide-y divide-slate-100 text-xs">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-slate-800 font-medium">1. AST Syntax</span>
                    <span
                      className={`font-bold transition-colors duration-500 ${
                        gateAstPassed ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    >
                      ✓ PASSED
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-slate-800 font-medium">2. TypeScript</span>
                    <span
                      className={`font-bold transition-colors duration-500 ${
                        gateTsPassed ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    >
                      ✓ PASSED
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-slate-800 font-medium">3. Call-site Scope</span>
                    <span
                      className={`font-bold transition-colors duration-500 ${
                        gateScopePassed ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    >
                      ✓ PASSED
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-slate-800 font-medium">4. Dry-run Tests</span>
                    <span
                      className={`font-bold transition-colors duration-500 ${
                        gateTestPassed ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    >
                      ✓ PASSED
                    </span>
                  </div>
                </div>

                {/* Draft PR Ready Section */}
                <div
                  className={`pt-4 border-t border-slate-200/90 space-y-1.5 transition-all duration-300 ${
                    prReady ? 'opacity-100 translate-y-0' : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4 text-[#004EE8]" />
                      <span className="font-bold text-[#000E29] text-sm uppercase tracking-wide">
                        DRAFT PR READY
                      </span>
                    </div>
                    <span className="text-slate-600 font-bold text-xs">#142</span>
                  </div>

                  <div className="text-xs font-sans font-medium text-slate-800 leading-normal">
                    chore(deps): migrate Stripe customer creation to v18
                  </div>

                  {/* Small Green State Pill */}
                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      Verified · Draft only · No auto-merge
                    </span>
                    <span className="text-slate-600 font-mono">1 file changed (+1, -1)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* BOTTOM ANCHOR BAR (Restrained footer note & scroll completion indicator) */}
        {/* ======================================================================= */}
        <div className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-12 pb-6 sm:pb-8 pt-4 flex items-center justify-between text-xs font-mono text-slate-600 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Zero auto-merge invariant</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="hidden sm:inline">Read-only AST observation</span>
          </div>

          <div className="flex items-center gap-2">
            <span ref={statusTextRef} className="text-slate-600">
              01 / 04 — DETECTS CHANGES
            </span>
            <span className="text-[#004EE8]">↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
