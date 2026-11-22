import { type ReactNode } from 'react'

type Status = 'online' | 'offline' | 'error'

interface StatusDotProps {
  status: Status
  label?: string
}

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  offline: '#999999',
  error: '#ef4444',
}

export function StatusDot({ status, label }: StatusDotProps) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
        aria-label={status}
      />
      {label && <span className="text-[11px] text-muted">{label}</span>}
    </span>
  )
}
