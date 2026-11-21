"use client"

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col bg-[#080a0f] text-[#e8eaf2]">
      <h1 className="text-2xl font-bold">SwingPulse Dashboard</h1>
      <p className="text-muted">Paper Trading Mode</p>
      <div className="mt-4 p-4 bg-[#0f1218] border border-[#1e232e] rounded-[6px]">
        <h2 className="text-xs font-bold text-[#7c8290] uppercase">Test</h2>
        <p className="text-sm">Hello World</p>
      </div>
    </div>
  )
}
