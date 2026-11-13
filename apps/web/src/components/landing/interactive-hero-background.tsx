'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface InteractiveHeroBackgroundProps {
  className?: string;
  initialX?: string;
  initialY?: string;
  maskDirection?: 'bottom' | 'top';
}

/**
 * InteractiveHeroBackground
 * Interactive cursor-following spotlight reveal effect.
 * The 45-degree diagonal lines are dynamically illuminated and revealed wherever
 * the user moves their cursor across the radiant sky.
 * No white haze, no milky wash, no artificial white fog block.
 */
export function InteractiveHeroBackground({
  className = '',
  initialX = '75%',
  initialY = '25%',
  maskDirection = 'bottom',
}: InteractiveHeroBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const entranceLayerRef = useRef<HTMLDivElement>(null);
  const maskClassName = maskDirection === 'top'
    ? '[mask-image:linear-gradient(to_top,black_0%,black_58%,rgba(0,0,0,0.88)_72%,rgba(0,0,0,0.5)_86%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_top,black_0%,black_58%,rgba(0,0,0,0.88)_72%,rgba(0,0,0,0.5)_86%,transparent_100%)]'
    : '[mask-image:linear-gradient(to_bottom,black_0%,black_58%,rgba(0,0,0,0.88)_72%,rgba(0,0,0,0.5)_86%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_58%,rgba(0,0,0,0.88)_72%,rgba(0,0,0,0.5)_86%,transparent_100%)]';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const parentSection = container.closest('section') || container;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = parentSection.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      container.style.setProperty('--spotlight-x', `${x}px`);
      container.style.setProperty('--spotlight-y', `${y}px`);
      container.style.setProperty('--spotlight-opacity', '1');
    };

    const handlePointerLeave = () => {
      // Soft ambient fade when pointer leaves the section
      container.style.setProperty('--spotlight-opacity', '0.35');
    };

    const handlePointerEnter = () => {
      container.style.setProperty('--spotlight-opacity', '1');
    };

    parentSection.addEventListener('pointermove', handlePointerMove as EventListener, { passive: true });
    parentSection.addEventListener('pointerleave', handlePointerLeave as EventListener, { passive: true });
    parentSection.addEventListener('pointerenter', handlePointerEnter as EventListener, { passive: true });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimateIntro = maskDirection === 'bottom';
    const animationContext = gsap.context(() => {
      const entranceLayer = entranceLayerRef.current;
      if (!entranceLayer || !shouldAnimateIntro || prefersReducedMotion) {
        container.classList.remove('hero-entrance-active');
        if (entranceLayer) {
          gsap.set(entranceLayer, { autoAlpha: 0 });
        }
        return;
      }

      gsap.set(entranceLayer, {
        autoAlpha: 1,
        '--hero-entrance-lines-angle': '90deg',
      } as gsap.TweenVars);

      const entranceTimeline = gsap.timeline({
        onComplete: () => {
          container.classList.remove('hero-entrance-active');
          gsap.set(entranceLayer, { visibility: 'hidden' });
        },
      });

      entranceTimeline.to(entranceLayer, {
        '--hero-entrance-lines-angle': '45deg',
        duration: 1.6,
        ease: 'power3.out',
      } as gsap.TweenVars).to(entranceLayer, {
        autoAlpha: 0,
        duration: 0.4,
        ease: 'power2.out',
      });
    }, container);

    return () => {
      parentSection.removeEventListener('pointermove', handlePointerMove as EventListener);
      parentSection.removeEventListener('pointerleave', handlePointerLeave as EventListener);
      parentSection.removeEventListener('pointerenter', handlePointerEnter as EventListener);
      animationContext.revert();
    };
  }, [maskDirection]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${maskClassName} ${className} ${maskDirection === 'bottom' ? 'hero-entrance-active' : ''}`}
      style={
        {
          '--spotlight-x': initialX,
          '--spotlight-y': initialY,
          '--spotlight-opacity': '0.9',
        } as React.CSSProperties
      }
    >
      {/* Temporary full-hero entrance layer. The approved interactive layer stays below it unchanged. */}
      <div
        ref={entranceLayerRef}
        className="absolute inset-0 hero-entrance-lines"
        aria-hidden="true"
      />

      {/* 1. Interactive Cursor-Revealed Bright Diagonal Lines ONLY */}
      <div className="absolute inset-0 hero-spotlight-lines" />

      {/* 2. Starry speckle field */}
      <div className="absolute inset-0 bg-star-pattern opacity-60" />
    </div>
  );
}
