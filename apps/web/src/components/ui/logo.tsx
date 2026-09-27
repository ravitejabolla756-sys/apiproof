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
    >
      {/* Offset Bracket Left */}
      <path
        d="M 9 8 L 5 8 L 5 24 L 9 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Offset Bracket Right */}
      <path
        d="M 23 8 L 27 8 L 27 24 L 23 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Organic Trace Curve Between Nodes */}
      <path
        d="M 10 16 C 13 12, 14 20, 17 16 C 19 13, 21 16, 22 16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Glowing Change Trace Node */}
      <circle cx="17" cy="16" r="2.5" fill="#3B82F6" />
    </svg>
  );
}
