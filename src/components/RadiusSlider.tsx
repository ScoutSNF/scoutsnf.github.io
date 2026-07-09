const STEPS = [10, 15, 20, 25, 30, 35, 40]

export function RadiusSlider({
  value,
  onChange,
  facilityCount
}: {
  value: number
  onChange: (v: number) => void
  facilityCount: number
}) {
  const idx = STEPS.indexOf(value)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor="radius" className="font-medium">
          Radius: {value} mi
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400">{facilityCount} facilities</span>
      </div>
      <input
        id="radius"
        type="range"
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={idx === -1 ? 0 : idx}
        onChange={(e) => onChange(STEPS[Number(e.target.value)])}
        className="w-full accent-brand"
      />
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
        {STEPS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  )
}
