import React from "react";

interface TokTickLogoProps {
  size?: number;
  className?: string;
}

export const TokTickLogo: React.FC<TokTickLogoProps> = ({ size = 36, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="toktickGradComponent" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A859" />
          <stop offset="0.5" stopColor="#006B3C" />
          <stop offset="1" stopColor="#004D2A" />
        </linearGradient>
        <linearGradient id="ticketSheenComponent" x1="8" y1="6" x2="56" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <filter id="ticketShadowComponent" x="0" y="2" width="64" height="62" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Ticket Body with distinctive side notches */}
      <path
        d="M10 14C10 9.58172 13.5817 6 18 6H46C50.4183 6 54 9.58172 54 14V25C51.2386 25 49 27.2386 49 30C49 32.7614 51.2386 35 54 35V50C54 54.4183 50.4183 58 46 58H18C13.5817 58 10 54.4183 10 50V35C12.7614 35 15 32.7614 15 30C15 27.2386 12.7614 25 10 25V14Z"
        fill="url(#toktickGradComponent)"
        filter="url(#ticketShadowComponent)"
      />

      {/* Ticket crisp highlight border */}
      <path
        d="M10 14C10 9.58172 13.5817 6 18 6H46C50.4183 6 54 9.58172 54 14V25C51.2386 25 49 27.2386 49 30C49 32.7614 51.2386 35 54 35V50C54 54.4183 50.4183 58 46 58H18C13.5817 58 10 54.4183 10 50V35C12.7614 35 15 32.7614 15 30C15 27.2386 12.7614 25 10 25V14Z"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="1.5"
      />

      {/* Sheen reflection top half */}
      <path
        d="M10 14C10 9.58172 13.5817 6 18 6H46C50.4183 6 54 9.58172 54 14V25C51.2386 25 49 27.2386 49 30H15C15 27.2386 12.7614 25 10 25V14Z"
        fill="url(#ticketSheenComponent)"
      />

      {/* Subtle dashed perforation line */}
      <line x1="16" y1="30" x2="48" y2="30" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* The "Tick" (Checkmark) with IT Tech aesthetic */}
      <path
        d="M20 31L28 39L44 21"
        stroke="#A7F3D0"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 31L28 39L44 21"
        stroke="#34D399"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* IT Pulse / Status Node Accent */}
      <circle cx="44" cy="21" r="3.5" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
};
