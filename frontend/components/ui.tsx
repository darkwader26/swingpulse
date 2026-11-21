import * as React from "react"

export function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-sm p-4 ${className ?? ""}`}>
      {children}
    </div>
  )
}

export function Metric({
  label,
  value,
  delta,
  deltaVariant = "neu",
}: {
  label: string
  value: string
  delta: string
  deltaVariant?: "pos" | "neg" | "neu"
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <span className="text-3xl font-bold font-mono leading-none">{value}</span>
      <span className={`text-xs font-mono ${deltaVariant === "pos" ? "text-success" : deltaVariant === "neg" ? "text-danger" : "text-muted"}`}>
        {delta}
      </span>
    </div>
  )
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex items-center">
      <span
        className={`w-2 h-2 rounded-full ${online ? "bg-success" : "bg-danger"} animate-pulse`}
      />
    </span>
  )
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "success" | "danger" | "warning"
}) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border"
  const variants: Record<string, string> = {
    default: "border-surface text-muted",
    success: "border-success text-success bg-success/10",
    danger: "border-danger text-danger bg-danger/10",
    warning: "border-warning text-warning bg-warning/10",
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}

export function Button({
  children,
  variant = "outline",
  onClick,
  className,
}: {
  children: React.ReactNode
  variant?: "default" | "outline"
  onClick?: () => void
  className?: string
}) {
  const base =
    "inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-semibold transition-colors"
  const variants: Record<string, string> = {
    default: "bg-accent text-[oklch(0.15,0,0)] border-accent hover:bg-accent/90",
    outline: "border-border hover:bg-surface-elev",
  }
  return (
    <button className={`${base} ${variants[variant]} ${className ?? ""}`} onClick={onClick}>
      {children}
    </button>
  )
}
