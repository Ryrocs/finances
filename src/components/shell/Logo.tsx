'use client';

import { useId } from 'react';

export function Logo({ className }: { className?: string }) {
  // Unique gradient id: the logo appears several times (some instances hidden), and a gradient
  // defined inside a display:none SVG doesn't paint for the others.
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
      <path d="M18 40 L28 30 L35 36 L46 23" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="23" r="4" fill="#fff" />
    </svg>
  );
}
