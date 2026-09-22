/** UIアイコン。装飾なので支援技術からは隠す（FE-001 §27）。 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function MenuIcon() {
  return (
    <svg {...base} width="24" height="24" viewBox="0 0 24 24">
      <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
    </svg>
  );
}

export function PinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function YenIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <path d="M5 4.5 12 13m7-8.5L12 13m0 0v6.5M7.5 14.5h9M7.5 17.5h9" />
    </svg>
  );
}

export function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <path d="M21.5 16.9v2.6a1.8 1.8 0 0 1-2 1.8 17.6 17.6 0 0 1-7.7-2.7 17.3 17.3 0 0 1-5.3-5.3A17.6 17.6 0 0 1 3.8 5.5a1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14 14 0 0 0 5.3 5.3l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.6 1.9Z" />
    </svg>
  );
}

export function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

export function CalendarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 17 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth={2}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function SearchOffIcon({ size = 28 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.6}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4M8.5 11h5" />
    </svg>
  );
}
