import React from "react";

export function ApiProofLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      className={`shrink-0 aspect-square ${className}`}
      style={{ maxWidth: '100%', maxHeight: '100%' }}
      aria-label="MY OWL Logo"
    >
      {/* Owl body & ear tufts */}
      <path
        d="M 7 10 L 11 6 L 15 9.5 L 17 9.5 L 21 6 L 25 10 C 25 10 26 18 26 21 C 26 26 21.5 28 16 28 C 10.5 28 6 26 6 21 C 6 18 7 10 7 10 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Left eye */}
      <circle cx="11.5" cy="16.5" r="3.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="11.5" cy="16.5" r="1.5" fill="currentColor" />
      {/* Right eye */}
      <circle cx="20.5" cy="16.5" r="3.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="20.5" cy="16.5" r="1.5" fill="currentColor" />
      {/* Beak */}
      <polygon points="16,21.5 14,19 18,19" fill="currentColor" />
    </svg>
  );
}

export { ApiProofLogo as MyOwlLogo };
