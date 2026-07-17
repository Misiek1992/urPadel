// urPadel brand mark: a perforated padel racket with a ball, in the club's
// volt-on-navy palette. Server-safe (pure SVG, no client hooks).

export function PadelMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="upl-racket" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaff8f" />
          <stop offset="1" stopColor="#c3e830" />
        </linearGradient>
        <linearGradient id="upl-ball" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="1" stopColor="#2f7de1" />
        </linearGradient>
      </defs>
      <g transform="rotate(-24 21 20)">
        <rect x="8" y="1" width="26" height="33" rx="13" fill="url(#upl-racket)" />
        <g fill="#0a1425">
          <circle cx="16" cy="11" r="1.7" />
          <circle cx="21" cy="11" r="1.7" />
          <circle cx="26" cy="11" r="1.7" />
          <circle cx="16" cy="17" r="1.7" />
          <circle cx="21" cy="17" r="1.7" />
          <circle cx="26" cy="17" r="1.7" />
          <circle cx="16" cy="23" r="1.7" />
          <circle cx="21" cy="23" r="1.7" />
          <circle cx="26" cy="23" r="1.7" />
        </g>
        <rect x="18" y="33" width="6" height="12" rx="3" fill="url(#upl-racket)" />
      </g>
      <circle cx="38" cy="38" r="6.5" fill="url(#upl-ball)" />
      <path
        d="M33.5 35.6a6.5 6.5 0 0 1 9 0"
        stroke="#0a1425"
        strokeWidth="1.3"
        fill="none"
      />
      <path
        d="M33.5 40.4a6.5 6.5 0 0 0 9 0"
        stroke="#0a1425"
        strokeWidth="1.3"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  size = 32,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <PadelMark size={size} />
      {withWordmark && (
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-volt-400">ur</span>
          <span className="text-white">Padel</span>
        </span>
      )}
    </span>
  );
}
