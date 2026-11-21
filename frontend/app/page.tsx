"use client"

import { useState } from "react"
import { Card, Metric, StatusDot, Badge, Button } from "../components/ui"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function Dashboard() {
  const [killSwitch, setKillSwitch] = useState(false)

  return (
    <div className="h-full flex flex-col bg-[#080a0f] text-[#e8eaf2]">
      <header className="flex items-center justify-between border-b border-[#1e232e] bg-[#0f1218]/80 backdrop-blur pb-3 pt-2 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-[#00d4ff] flex items-center justify-center text-[#080a0f] font-bold text-sm">
              SP
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight">SwingPulse</span>
              <span className="text-[10px] text-[#7c8290] uppercase tracking-wider mt-0.5">Desk Terminal v0.1.0</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-[#ff3333] text-[#ffffff] font-bold text-xs tracking-wider killswitch {killSwitch ? "active" : ""}">
            <span className="dot"></span>
            <span>{killSwitch ? "SYSTEM HALTED" : "KILL SWITCH"}</span>
          </div>
          <Button onClick={() => setKillSwitch((p) => !p)} variant="outline" className="px-2 py-1">
            {killSwitch ? "Restore" : "Halt"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Today P&L</span>
            <span className="metric-value">+$1,240.50</span>
            <span className="text-xs text-[#22c55e] font-mono">+1.24% · Win rate 62%</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Open Positions</span>
            <span className="metric-value">4</span>
            <span className="text-xs text-[#7c8290] font-mono">Max 8</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Daily Risk Left</span>
            <span className="metric-value">$1,850</span>
            <span className="text-xs text-[#7c8290] font-mono">Limit: $2,000</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Regime</span>
            <span className="metric-value text-[#00d4ff]">BULL</span>
            <span className="text-xs text-[#7c8290] font-mono">SPY > 200 EMA</span>
          </div>
        </Card>
      </div>

      <div className="p-3">
        <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Agent Decision Log</h2>
        <div className="h-[200px] overflow-y-auto font-mono text-[10px]">
          <div className="text-[#7c8290] text-center py-4">Waiting for agent events…</div>
        </div>
      </div>

      <footer className="border-t border-[#1e232e] pt-2 pb-2 text-[10px] text-[#7c8290]">
        SwingPulse v0.1.0 — Paper Trading. Not financial advice.
      </footer>
    </div>
  )
}
