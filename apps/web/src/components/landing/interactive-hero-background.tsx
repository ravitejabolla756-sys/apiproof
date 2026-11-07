'use client';

import React, { useEffect, useRef } from 'react';

interface InteractiveHeroBackgroundProps {
  className?: string;
  initialX?: string;
  initialY?: string;
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
}: InteractiveHeroBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    return () => {
      parentSection.removeEventListener('pointermove', handlePointerMove as EventListener);
      parentSection.removeEventListener('pointerleave', handlePointerLeave as EventListener);
      parentSection.removeEventListener('pointerenter', handlePointerEnter as EventListener);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_75%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_75%,transparent_98%)] ${className}`}
      style={
        {
          '--spotlight-x': initialX,
          '--spotlight-y': initialY,
          '--spotlight-opacity': '0.9',
        } as React.CSSProperties
      }
    >
      {/* 1. Interactive Cursor-Revealed Bright Diagonal Lines ONLY */}
      <div className="absolute inset-0 hero-spotlight-lines" />

      {/* 2. Starry speckle field */}
      <div className="absolute inset-0 bg-star-pattern opacity-80" />
    </div>
  );
}
