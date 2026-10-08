import type { FacilityKind } from '../types/facility'

/**
 * A neutral monogram, used wherever a facility has no real photo.
 *
 * This replaced two pieces of clip art (a figure-with-cane glyph for SNFs, a medical cross for
 * hospitals) that repeated down every row of a list and read as decoration rather than
 * information. Initials at least identify the row they belong to. Kind is still carried by the
 * TypeBadge beside the name and by marker colour on the map, so nothing is lost by making this
 * tile quiet.
 */
function initialsFor(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !/^(of|the|at|and|for|on|in|to|a|an|by)$/i.test(w))

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function PlaceholderImage({ kind, name, className }: { kind: FacilityKind; name: string; className?: string }) {
  const initials = initialsFor(name)

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={name}>
      <rect
        width="64"
        height="64"
        rx="8"
        className={kind === 'hospital' ? 'fill-red-50 dark:fill-red-950/40' : 'fill-slate-100 dark:fill-slate-800'}
      />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={initials.length > 1 ? 26 : 30}
        fontWeight="600"
        className={
          kind === 'hospital'
            ? 'fill-red-700 dark:fill-red-300'
            : 'fill-slate-500 dark:fill-slate-400'
        }
        style={{ fontFamily: 'inherit', letterSpacing: '0.02em' }}
      >
        {initials}
      </text>
    </svg>
  )
}
