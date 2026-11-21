"use client"

import { useState, useRef, useEffect } from "react"

const WATCHLIST = [
  { sym: "AAPL", px: 189.50, ch: +1.24 },
  { sym: "NVDA", px: 872.00, ch: +2.10 },
  { sym: "MSFT", px: 418.30, ch: -0.45 },
  { sym: "AMD", px: 145.20, ch: +0.88 },
  { sym: "TLT", px: 92.40, ch: -1.10 },
  { sym: "GLD", px: 231.50, ch: +0.32 },
]

const PIPELINE = [
  { name: "SCANNER", status: "ONLINE", items: 42 },
  { name: "SIGNAL GEN", status: "ACTIVE", items: 6 },
  { name: "RISK MGMT", status: "GATED", items: 3 },
  { name: "EXECUTION", status: "PAPER", items: 2 },
  { name: "OPS", status: "LOGGING", items: 2 },
]

export default function Dashboard() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [userName, setUserName] = useState("")
  const [terminalInput, setTerminalInput] = useState("")
  const [terminalLines, setTerminalLines] = useState([
    "C:\\SWINGPULSE> SYSTEM INITIALIZED",
    "C:\\SWINGPULSE> LOADING MODULES...",
    "C:\\SWINGPULSE> MARKET DATA CONNECTED",
    "C:\\SWINGPULSE> AGENT PIPELINE READY",
    "C:\\SWINGPULSE> AWAITING USER LOGON",
  ])
  const terminalRef = useRef(null)

  const handleGoogleLogin = () => {
    setLoggedIn(true)
    setUserName("Trader_01")
    setTerminalLines((prev) => [
      ...prev,
      "C:\\SWINGPULSE> AUTHENTICATING VIA GOOGLE OAUTH2...",
      "C:\\SWINGPULSE> TOKEN ACQUIRED",
      "C:\\SWINGPULSE> USER LOGGED IN: Trader_01",
    ])
  }

  const handleTerminalSubmit = (e) => {
    e.preventDefault()
    if (!terminalInput.trim()) return
    const input = terminalInput.trim()
    setTerminalLines((prev) => [...prev, `C:\\SWINGPULSE> ${input}`])
    setTerminalInput("")
    setTimeout(() => {
      setTerminalLines((prev) => [
        ...prev,
        `C:\\SWINGPULSE> Command '${input}' executed`,
      ])
    }, 500)
  }

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  if (!loggedIn) {
    return (
      <div className="h-full flex flex-col bg-[#000000] text-[#00ff00] font-mono">
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 border-4 border-[#00ff00] bg-[#0a0a0a] rounded-lg shadow-[0_0_20px_rgba(0,255,0,0.3)]">
            <div className="mb-6">
              <div className="text-4xl font-bold mb-2">SWINGPULSE</div>
              <div className="text-[#ffff00] text-sm">AGENT-PIPELINE SWING TRADING DESK</div>
              <div className="text-[#7c8290] text-xs mt-2">VERSION 1.0.0 - PAPER TRADING MODE</div>
            </div>
            <div className="mb-6">
              <div className="text-[#ffff00] text-sm mb-2">SYSTEM STATUS: AWAITING AUTHENTICATION</div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ffff00] animate-pulse"></div>
                <span className="text-[#ffff00] text-xs">GOOGLE OAUTH2 READY</span>
              </div>
            </div>
            <button
              onClick={handleGoogleLogin}
              className="bg-[#00ff00] text-[#000000] px-8 py-3 font-bold text-lg rounded shadow-[0_0_15px_rgba(0,255,0,0.5)] hover:bg-[#33ff33] transition-colors"
            >
              LOGIN WITH GOOGLE
            </button>
            <div className="mt-4 text-xs text-[#7c8290]">
              SECURE OAUTH2 AUTHENTICATION REQUIRED<br />
              NO LIVE CAPITAL - PAPER TRADING ONLY
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#000000] text-[#00ff00] font-mono overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-50"
           style={{
             background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
             backgroundSize: "100% 2px, 3px 100%",
           }}
        ></div>

      <header className="h-12 border-b border-[#00ff00] bg-[#0a0a0a] flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#00ff00] animate-pulse"></div>
          <span className="font-bold text-lg">SWINGPULSE DESK TERMINAL</span>
          <span className="text-[#ffff00] text-xs ml-2">PAPER TRADING</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#00ff00] text-sm">{userName}</span>
          <span className="text-[#ffff00] text-xs">GOOGLE OAUTH2 ACTIVE</span>
          <button
            onClick={() => { setLoggedIn(false); setUserName("") }}
            className="text-xs border border-[#ff0000] text-[#ff0000] px-2 py-1 rounded hover:bg-[#ff0000] hover:text-[#000000] transition-colors"
          >
            LOGOUT
          </button>
        </div>
      </header>

      <div className="flex-1 flex h-full overflow-hidden">
        <div className="w-1/3 border-r border-[#00ff00] bg-[#050505] p-3 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#00ff00]">C:\\SWINGPULSE\\WATCHLIST</span>
            <span className="text-[#ffff00] text-xs">23 INSTRUMENTS</span>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[#00ff00]">
                <th className="text-left pb-1 text-[#7c8290]">SYMBOL</th>
                <th className="text-right pb-1 text-[#7c8290]">PRICE</th>
                <th className="text-right pb-1 text-[#7c8290]">CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST.map((w) => (
                <tr key={w.sym} className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a]">
                  <td className="py-1 font-mono">{w.sym}</td>
                  <td className="py-1 text-right font-mono">${w.px.toFixed(2)}</td>
                  <td className={`py-1 text-right font-mono ${w.ch >= 0 ? "text-[#00ff00]" : "text-[#ff0000]"}`}>
                    {w.ch >= 0 ? "+" : ""}${w.ch.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="w-1/3 border-r border-[#00ff00] bg-[#000000] p-3 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#00ff00]">C:\\SWINGPULSE\\TERMINAL</span>
            <span className="text-[#ffff00] text-xs">v1.0.0</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#000000] p-2 border border-[#1a1a1a] rounded-sm" ref={terminalRef}>
            {terminalLines.map((line, i) => (
              <div key={i} className="mb-1">
                {line.includes("ERROR") || line.includes("FAIL") ? (
                  <span className="text-[#ff0000]">{line}</span>
                ) : line.includes("APPROVED") || line.includes("ONLINE") || line.includes("READY") ? (
                  <span className="text-[#00ff00]">{line}</span>
                ) : line.includes("WARNING") || line.includes("PENDING") ? (
                  <span className="text-[#ffff00]">{line}</span>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleTerminalSubmit} className="mt-2 flex gap-2">
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              className="flex-1 bg-[#000000] text-[#00ff00] border border-[#00ff00] px-2 py-1 text-sm font-mono focus:outline-none focus:border-[#ffff00]"
              placeholder="C:\\SWINGPULSE>"
            />
            <button
              type="submit"
              className="bg-[#00ff00] text-[#000000] px-3 py-1 font-bold text-xs rounded hover:bg-[#33ff33] transition-colors"
            >
              ENTER
            </button>
          </form>
        </div>

        <div className="w-1/3 bg-[#050505] p-3 overflow-y-auto">
          <div className="mb-3">
            <span className="text-xs font-bold text-[#00ff00]">AGENT PIPELINE</span>
            <span className="text-[#ffff00] text-xs ml-2">SWING TRADING DESK</span>
          </div>
          <div className="space-y-2">
            {PIPELINE.map((agent, i) => (
              <div key={agent.name} className="flex items-center gap-2 p-2 border border-[#1a1a1a] rounded-sm bg-[#0a0a0a]">
                <div className={`w-2 h-2 rounded-full ${agent.status === "ONLINE" || agent.status === "ACTIVE" ? "bg-[#00ff00]" : agent.status === "PAPER" ? "bg-[#ffff00]" : "bg-[#ff0000]"}`}></div>
                <span className="text-xs font-mono">{agent.name}</span>
                <span className="text-[#ffff00] text-xs ml-1">{agent.items}</span>
                <span className="text-xs text-[#00ff00] ml-auto">{agent.status}</span>
                {i < PIPELINE.length - 1 && <span className="text-[#00ff00] text-xs">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 border border-[#00ff00] p-2 bg-[#000000]">
            <span className="text-xs font-bold text-[#00ff00] block mb-1">SYSTEM RESOURCES</div>
            <div className="flex justify-between text-[10px] mb-1">
              <span>CPU</span>
              <span className="text-right">42%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] h-1 rounded-sm overflow-hidden">
              <div className="bg-[#00ff00] h-full" style={{ width: "42%" }}></div>
            </div>
            <div className="flex justify-between text-[10px] mb-1">
              <span>MEMORY</span>
              <span className="text-right">68%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] h-1 rounded-sm overflow-hidden">
              <div className="bg-[#ffff00] h-full" style={{ width: "68%" }}></div>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>NETWORK</span>
              <span className="text-right">12%</span>
            </div>
            <div className="w-full bg-[#1a1a1a] h-1 rounded-sm overflow-hidden">
              <div className="bg-[#00ff00] h-full" style={{ width: "12%" }}></div>
            </div>
          </div>
        </div>
      </div>

      <footer className="h-8 border-t border-[#00ff00] bg-[#0a0a0a] flex items-center justify-between px-4 text-[10px] text-[#7c8290] z-10">
        <span>SWINGPULSE v1.0.0 - PAPER TRADING MODE</span>
        <span>NO LIVE CAPITAL - NOT FINANCIAL ADVICE</span>
      </footer>
    </div>
  )
}
