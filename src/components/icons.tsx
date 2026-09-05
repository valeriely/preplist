interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function SearchIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  )
}

export function MoonIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

export function PlanIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3.5" y="4.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="4.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="14.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="14.5" width="7" height="5" rx="2" />
    </svg>
  )
}

export function CartIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.55L20 8H6.2" />
      <circle cx="10" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  )
}

export function SplitIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 6h5l3 6 3-6h5" />
      <path d="M4 18h5l3-6" />
      <circle cx="20" cy="18" r="1.4" />
    </svg>
  )
}

export function LogIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 4.5h11l3 3V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  )
}

export function CookIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 11h15a7.5 7.5 0 0 1-7.5 7.5A7.5 7.5 0 0 1 4.5 11Z" />
      <path d="M9 7.5c0-1.4 1.3-1.9 1.3-3.2M13 7.5c0-1.4 1.3-1.9 1.3-3.2" />
      <path d="M3.5 20.5h17" />
    </svg>
  )
}

export function TimeIcon({ size = 13 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}
