/**
 * CMS star rating.
 *
 * The five glyphs are marked aria-hidden and the real value is exposed once as text. Previously a
 * screen reader walked five ★ characters and announced the same thing for a 1-star facility as a
 * 5-star one — the visual fill carried the entire meaning and none of it reached assistive tech.
 */
export function StarRating({
  rating,
  label,
  showValue = false
}: {
  rating: number | null
  label?: string
  /** Render the numeral next to the stars, for places where the number itself is the point. */
  showValue?: boolean
}) {
  if (rating == null) {
    return <span className="text-xs text-[--color-text-muted]">Not rated</span>
  }

  const full = Math.round(rating)
  const text = label ?? `${rating} out of 5 stars`

  return (
    <span className="inline-flex items-center gap-0.5" title={text}>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < full ? 'text-gold' : 'text-slate-300 dark:text-slate-600'}>
            ★
          </span>
        ))}
      </span>
      {showValue && <span className="ml-1 text-sm font-semibold tabular-nums">{rating}</span>}
      <span className="sr-only">{text}</span>
    </span>
  )
}
