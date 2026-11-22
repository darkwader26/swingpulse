import { type ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  deltaType?: 'pos' | 'neg' | 'neu'
  subLabel?: string
  sparkline?: number[]
}

function sparkline(points: number[]) {
  if (!points.length) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = 100 / (points.length - 1 || 1)
  const d = points
    .map((p, i) => {
      const y = 100 - ((p - min) / range) * 100
      return `${i === 0 ? 'M' : 'L'}${i * step}% ${y}%`
    })
    .join(' ')
  return <path d={d} fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="card">
      <div className="metric">
        <div className="metric-label">{label}</div>
        <div className="metric-value mono">{value}</div>
        {delta && (
          <div className={`metric-delta ${deltaType}`}>{delta}</div>
        )}
        {subLabel && <div className="metric-delta neu">{subLabel}</div>}
        {points && points.length && (
          <svg width="100%" height="28" className="mt-2" aria-hidden="true">
            {sparkline(points)}
          </svg>
        )}
      </div>
    </div>
  )
}
