"use client"

import * as React from "react"

export function Card({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-[#0a0a0a] border border-[#00ff00] rounded-none p-4 ${className ?? ""}`}>
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
      <span className="text-[10px] uppercase tracking-wider text-[#7c8290]">{label}</span>
      <span className="text-2xl font-bold font-mono leading-none">{value}</span>
      <span className={`text-xs font-mono ${deltaVariant === "pos" ? "text-[#00ff00]" : deltaVariant === "neg" ? "text-[#ff0000]" : "text-[#7c8290]"}`}>
        {delta}
      </span>
    </div>
  )
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="relative flex items-center">
      <span
        className={`w-2 h-2 rounded-full ${online ? "text-[#00ff00]" : "text-[#ff0000]"}`}
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
  const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-bold border"
  const variants: Record<string, string> = {
    default: "border-[#7c8290] text-[#7c8290]",
    success: "border-[#00ff00] text-[#00ff00] bg-[#00ff00]/10",
    danger: "border-[#ff0000] text-[#ff0000] bg-[#ff0000]/10",
    warning: "border-[#ffff00] text-[#ffff00] bg-[#ffff00]/10",
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}

export function Button({
  children,
  variant = "outline",
  size = "md",
  onClick,
  className,
}: {
  children: React.ReactNode
  variant?: "default" | "outline"
  size?: "sm" | "md"
  onClick?: () => void
  className?: string
}) {
  const base =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-none text-sm font-bold border transition-all duration-200 focus:outline-none"
  const sizeStyles: Record<string, string> = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  }
  const variants: Record<string, string> = {
    default: "bg-[#00ff00] text-[#000000] border-[#00ff00] hover:bg-[#33ff33]",
    outline: "border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00] hover:text-[#000000]",
  }
  return (
    <button
      className={`${base} ${sizeStyles[size]} ${variants[variant]} ${className ?? ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
