import { type ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  subtitle?: string
  icon?: string
}

export function EmptyState({ title, subtitle, icon }: EmptyStateProps) {
  return (
    <div className="empty">
      {icon && <div className="text-[24px] mb-3">{icon}</div>}
      <div className="text-[11px] font-bold tracking-widest">{title}</div>
      {subtitle && <div className="text-[9px] text-muted mt-1">{subtitle}</div>}
    </div>
  )
}
