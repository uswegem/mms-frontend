/** TIPS logo for TANQR merchant display (Part A). */
export function TipsLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 56"
      className={className}
      aria-label="TIPS Tanzania Instant Payments System"
      role="img"
    >
      <g transform="translate(4, 6)">
        <path d="M4 38 C8 10, 18 8, 26 20" stroke="#1B8F4E" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M10 40 C16 14, 28 12, 36 24" stroke="#1E4FA3" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M16 42 C22 18, 36 16, 44 28" stroke="#111827" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M30 42 L38 48 L30 54 Z" fill="#F5C400" />
      </g>
      <text
        x="58"
        y="34"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="30"
        fontWeight="700"
        fontStyle="italic"
        fill="#3B5B9A"
      >
        TIPS
      </text>
      <text
        x="58"
        y="48"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="7.5"
        letterSpacing="0.8"
        fill="#6B7280"
      >
        TANZANIA INSTANT PAYMENTS SYSTEM
      </text>
    </svg>
  );
}
