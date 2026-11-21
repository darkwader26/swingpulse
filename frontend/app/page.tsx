"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, Metric, StatusDot, Badge, Button } from "../components/ui"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface AgentStatus {
  scanner: { status: string; last_run: string | null; errors: number }
  signal_generator: { status: string; last_run: string | null; errors: number }
  risk_manager: { status: string; last_run: string | null; errors: number }
  executor: { status: string; mode: string; errors: number }
  ops: { status: string; last_run: string | null; errors: number }
}

interface Risk {
  daily_loss_percent: number
  daily_loss_limit: number
  open_positions: number
  max_positions: number
  sector_exposure: Record<string, number>
  kill_switch: boolean
}

interface Position {
  symbol: string
  side: string
  entry: number
  stop: number
  target: number
  qty: number
  unrealized_pnl: number
  r_multiple: string
  age: string
}

interface Signal {
  symbol: string
  setup_type: string
  direction: string
  entry_price: number
  stop_price: number
  target_1: number
  rr_ratio: number
  confidence: number
}

const MOCK_SIGNALS: Signal[] = [
  { symbol: "AAPL", setup_type: "pullback_to_20ema", direction: "long", entry_price: 189.50, stop_price: 184.20, target_1: 196.80, rr_ratio: 2.0, confidence: 0.72 },
  { symbol: "NVDA", setup_type: "breakout_20d_high", direction: "long", entry_price: 872.00, stop_price: 845.00, target_1: 908.00, rr_ratio: 2.0, confidence: 0.68 },
  { symbol: "TLT", setup_type: "pullback_to_20ema_short", direction: "short", entry_price: 92.40, stop_price: 94.10, target_1: 89.00, rr_ratio: 2.0, confidence: 0.70 },
  { symbol: "EEM", setup_type: "breakdown_20d_low", direction: "short", entry_price: 41.80, stop_price: 42.50, target_1: 40.60, rr_ratio: 2.0, confidence: 0.65 },
]

const MOCK_POSITIONS: Position[] = [
  { symbol: "AAPL", side: "Long", entry: 189.50, stop: 184.20, target: 196.80, qty: 145, unrealized_pnl: 442.00, r_multiple: "+0.83 R", age: "2d 4h" },
  { symbol: "NVDA", side: "Long", entry: 872.00, stop: 845.00, target: 908.00, qty: 45, unrealized_pnl: 315.00, r_multiple: "+0.60 R", age: "1d 12h" },
  { symbol: "TLT", side: "Short", entry: 92.40, stop: 94.10, target: 89.00, qty: 210, unrealized_pnl: -178.50, r_multiple: "-0.45 R", age: "5d 2h" },
  { symbol: "MSFT", side: "Pending", entry: 0, stop: 0, target: 0, qty: 0, unrealized_pnl: 0, r_multiple: "—", age: "Queued" },
]

const WATCHLIST = [
  { sym: "AAPL", px: 189.50, ch: +1.24, reg: "Bull" },
  { sym: "NVDA", px: 872.00, ch: +2.10, reg: "Bull" },
  { sym: "MSFT", px: 418.30, ch: -0.45, reg: "Bull" },
  { sym: "AMD", px: 145.20, ch: +0.88, reg: "Bull" },
  { sym: "TLT", px: 92.40, ch: -1.10, reg: "Neutral" },
  { sym: "GLD", px: 231.50, ch: +0.32, reg: "Neutral" },
  { sym: "EEM", px: 41.80, ch: -0.15, reg: "Bear" },
  { sym: "SLV", px: 28.90, ch: +0.45, reg: "Neutral" },
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
  const terminalRef = useRef<HTMLDivElement>(null)

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
      setTerminalLines((prev) => [...prev, `C:\\SWINGPULSE> Command '${input}' executed`])
    }, 500)
  }

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  if (!loggedIn) {
    return (
      <div className="h-full flex items-center justify-center bg-[#c0c0c0] font-[\"Courier_New\"] text-black">
        <div className="p-4 border-2 border-[#808080] bg-[#c0c0c0] shadow-[4px_4px_0px_#000000] max-w-md w-full">
          <div className="border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] p-1 bg-[#c0c0c0]">
            <div className="flex items-center gap-2 mb-3 bg-[#c0c0c0] px-2 py-1 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
              <div className="w-2 h-2 rounded bg-[#c0c0c0] border border-[#808080]"></div>
              <span className="text-xs font-bold text-black">SWINGPULSE</span>
            </div>
            <h2 className="text-xl font-bold text-black mb-4">SWINGPULSE</h2>
            <div className="text-[10px] text-[#808080] mb-6">
              AGENT-PIPELINE SWING TRADING DESK<br />
              VERSION 1.0.0 - PAPER TRADING MODE
            </div>
            <button
              onClick={handleGoogleLogin}
              className="w-full py-2 bg-[#c0c0c0] border-2 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080] rounded-none text-black font-bold text-sm hover:bg-[#e0e0e0] active:border-t-2 border-[#808080] active:border-l-2 border-[#808080] active:border-b-2 border-[#ffffff] active:border-r-2 border-[#ffffff] active:translate-y-1"
            >
              LOGIN WITH GOOGLE
            </button>
            <div className="mt-3 text-[10px] text-[#808080]">
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
      <div className="fixed inset-0 pointer-events-none z-50" style={{
        background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
        backgroundSize: "100% 2px, 3px 100%",
      }}></div>

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
                  <td className="py-1.5 font-mono">{w.sym}</td>
                  <td className="py-1.5 text-right font-mono">${w.px.toFixed(2)}</td>
                  <td className={`py-1.5 text-right font-mono ${w.ch >= 0 ? "text-[#00ff00]" : "text-[#ff0000]"}`}>
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

        <div className="lg:col-span-12">
          <Card className="card-hover">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] uppercase tracking-wider text-muted">Agent Decision Log</h2>
              <div className="flex items-center gap-2">
                <span className={`status-dot ${allOnline ? "status-online" : "status-offline"}`} />
                <span className="text-[10px] text-muted">Live feed</span>
              </div>
            </div>
            <div className="h-[200px] overflow-y-auto font-mono text-[10px]">
              <div className="space-y-1">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className="log-entry">
                      <span className="log-time">{log.split("]")[0]}]</span>
                      <span className="log-agent">{log.includes("Scanner") ? "Scanner" : log.includes("Signal") ? "Signal Gen" : log.includes("Risk") ? "Risk Mgmt" : log.includes("Execution") ? "Execution" : log.includes("Ops") ? "Ops" : "System"}</span>
                      <span className="log-msg">{log.split("] ").slice(1).join("] ")}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted text-center py-4">Waiting for agent events…</div>
                )}
              </div>
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
