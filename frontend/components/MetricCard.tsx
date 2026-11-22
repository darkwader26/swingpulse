interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaType?: 'pos' | 'neg' | 'neu'
  subLabel?: string
  sparkline?: number[]
}

export function MetricCard({
  label,
  value,
  delta,
  deltaType = 'neu',
  subLabel,
  sparkline: points,
}: MetricCardProps) {
  return (
    <div className="card h-full">
      <div className="metric">
        <div className="metric-label">{label}</div>
        <div className="metric-value mono">{value}</div>
        {delta && (
          <div className={`metric-delta ${deltaType}`}>{delta}</div>
        )}
        {subLabel && <div className="metric-delta neu">{subLabel}</div>}
      </div>
    </div>
  )
}
