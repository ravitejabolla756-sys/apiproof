import React from "react";

export function ApiProofLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="9" cy="16" r="4.5" fill="#111111" />
      <circle cx="23" cy="16" r="4.5" fill="#111111" />
      <path
        d="M 13.5 16 C 16 12, 16 20, 18.5 16"
        stroke="#111111"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="1.75" fill="#60A5FA" />
    </svg>
  );
}
