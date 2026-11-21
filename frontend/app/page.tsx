"use client"

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col bg-[#000000] text-[#00ff00] font-mono">
      <h1 className="text-2xl font-bold p-4">SWINGPULSE DESK TERMINAL</h1>
      <p className="text-[#ffff00] p-2">Paper Trading Mode</p>
      <div className="p-4 border-2 border-[#00ff00] bg-[#0a0a0a] w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-2">AGENT PIPELINE</span>
        <ul className="space-y-1 text-sm">
          <li className="text-[#00ff00]">SCANNER - ONLINE</li>
          <li className="text-[#00ff00]">SIGNAL GEN - ACTIVE</li>
          <li className="text-[#ffff00]">RISK MGMT - GATED</li>
          <li className="text-[#ffff00]">EXECUTION - PAPER</li>
          <li className="text-[#00ff00]">OPS - LOGGING</li>
        </ul>
        <h2 className="text-xl font-bold mt-4 mb-2">WATCHLIST</h2>
        <ul className="space-y-1 text-sm">
          <li className="text-[#00ff00]">AAPL $189.50 +1.24%</li>
          <li className="text-[#00ff00]">NVDA $872.00 +2.10%</li>
          <li className="text-[#ff0000]">MSFT $418.30 -0.45%</li>
          <li className="text-[#00ff00]">AMD $145.20 +0.88%</li>
          <li className="text-[#ff0000]">TLT $92.40 -1.10%</li>
        </ul>
      </div>
    </div>
  )
}
