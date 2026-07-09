export function StarRating({ rating, label }: { rating: number | null; label?: string }) {
  if (rating == null) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Not rated</span>
  }
  const full = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-0.5" title={label ?? `${rating} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'text-gold' : 'text-slate-300 dark:text-slate-700'}>
          ★
        </span>
      ))}
    </span>
  )
}
