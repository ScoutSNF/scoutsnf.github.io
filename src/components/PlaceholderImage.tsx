import type { FacilityKind } from '../types/facility'

const COLORS: Record<FacilityKind, string> = {
  snf: '#0ea5e9',
  hospital: '#ef4444'
}

export function PlaceholderImage({ kind, className }: { kind: FacilityKind; className?: string }) {
  const color = COLORS[kind]
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={`${kind} placeholder image`}>
      <rect width="64" height="64" rx="8" fill={color} opacity="0.15" />
      <circle cx="32" cy="26" r="12" fill="none" stroke={color} strokeWidth="2.5" />
      <path d="M20 50c0-8 5.4-14 12-14s12 6 12 14" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  )
}
