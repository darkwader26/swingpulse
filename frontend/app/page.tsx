"use client"

import { useState } from "react"
import { Card } from "../components/ui"

export default function Dashboard() {
  const [killSwitch, setKillSwitch] = useState(false)

  return (
    <div className="h-full flex flex-col bg-[#080a0f] text-[#e8eaf2]">
      <h1 className="text-2xl font-bold">SwingPulse Dashboard</h1>
      <p className="text-muted">Paper Trading Mode</p>
      <Card className="mt-4 p-4 bg-[#0f1218] border border-[#1e232e] rounded-[6px]">
        <h2 className="text-xs font-bold text-[#7c8290] uppercase">Test</h2>
        <p className="text-sm">{killSwitch ? "ON" : "OFF"}</p>
        <button onClick={() => setKillSwitch((p) => !p)} className="mt-2 px-2 py-1 bg-[#00d4ff] text-[#080a0f] rounded-[4px] text-sm font-bold">
          Toggle
        </button>
      </Card>
    </div>
  )
}
