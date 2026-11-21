"use client"

import { useState, useEffect, useRef } from "react"
import { Card, Metric, StatusDot, Badge, Button } from "../components/ui"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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

const MOCK_POSITIONS: Position[] = [
  { symbol: "AAPL", side: "Long", entry: 189.50, stop: 184.20, target: 196.80, qty: 145, unrealized_pnl: 442.00, r_multiple: "+0.83 R", age: "2d 4h" },
  { symbol: "NVDA", side: "Long", entry: 872.00, stop: 845.00, target: 908.00, qty: 45, unrealized_pnl: 315.00, r_multiple: "+0.60 R", age: "1d 12h" },
  { symbol: "TLT", side: "Short", entry: 92.40, stop: 94.10, target: 89.00, qty: 210, unrealized_pnl: -178.50, r_multiple: "-0.45 R", age: "5d 2h" },
  { symbol: "MSFT", side: "Pending", entry: 0, stop: 0, target: 0, qty: 0, unrealized_pnl: 0, r_multiple: "—", age: "Queued" },
]

const MOCK_SIGNALS: Signal[] = [
  { symbol: "AAPL", setup_type: "pullback_to_20ema", direction: "long", entry_price: 189.50, stop_price: 184.20, target_1: 196.80, rr_ratio: 2.0, confidence: 0.72 },
  { symbol: "NVDA", setup_type: "breakout_20d_high", direction: "long", entry_price: 872.00, stop_price: 845.00, target_1: 908.00, rr_ratio: 2.0, confidence: 0.68 },
  { symbol: "TLT", setup_type: "pullback_to_20ema_short", direction: "short", entry_price: 92.40, stop_price: 94.10, target_1: 89.00, rr_ratio: 2.0, confidence: 0.70 },
  { symbol: "EEM", setup_type: "breakdown_20d_low", direction: "short", entry_price: 41.80, stop_price: 42.50, target_1: 40.60, rr_ratio: 2.0, confidence: 0.65 },
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
  const [killSwitch, setKillSwitch] = useState(false)
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

  const handleLogout = () => {
    setLoggedIn(false)
    setUserName("")
    setKillSwitch(false)
  }

  const handleToggleKillSwitch = () => {
    setKillSwitch((prev) => {
      const next = !prev
      setTerminalLines((lines) => [...lines, `C:\\SWINGPULSE> KILL SWITCH ${next ? "ACTIVE" : "RESTORED"}`])
      return next
    })
  }

  const handleTerminalSubmit = (e: React.FormEvent) => {
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

  const now = new Date()
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false })

  if (!loggedIn) {
    return (
      <div className="h-full flex items-center justify-center bg-[#c0c0c0] text-black">
        <div className="p-4 border-2 border-[#808080] bg-[#c0c0c0] shadow-[4px_4px_0px_#000000] max-w-md w-full font-mono">
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
      <header className="h-12 border-b border-[#00ff00] bg-[#0a0a0a] flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-[#00ff00] flex items-center justify-center text-[#080a0f] font-bold text-sm">
              SP
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight">SwingPulse</span>
              <span className="text-[10px] uppercase tracking-wider mt-0.5">Desk Terminal v0.2.0</span>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-[#00ff00]/30 pl-4 ml-3">
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono text-[#7c8290]">{timeStr}</span>
              <span className="text-[10px] text-[#7c8290] uppercase tracking-wider">UTC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${killSwitch ? "bg-[#ff0000]" : "bg-[#00ff00]"}`}></span>
            <span className="text-xs font-mono">{killSwitch ? "SYSTEM HALTED" : "AGENTS ONLINE"}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border text-white font-bold text-xs tracking-wider ${killSwitch ? "border-[#ff0000] bg-[#ff0000]/10" : "border-[#00ff00] bg-[#00ff00]/10"}`}>
            <span className="dot"></span>
            <span>{killSwitch ? "SYSTEM HALTED" : "KILL SWITCH"}</span>
          </div>
          <Button onClick={handleToggleKillSwitch} variant="outline" className="px-2 py-1 text-xs">
            {killSwitch ? "Restore" : "Halt"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Today P&L</span>
            <span className="metric-value">+$1,240.50</span>
            <span className="text-xs text-[#00ff00] font-mono">+1.24% · Win rate 62%</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Open Positions</span>
            <span className="metric-value">{MOCK_POSITIONS.filter((p) => p.side !== "Pending").length}</span>
            <span className="text-xs text-[#7c8290] font-mono">Max 8</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Daily Risk Left</span>
            <span className="metric-value">$1,850</span>
            <span className="text-xs text-[#7c8290] font-mono">Limit: $2,000</span>
          </div>
          <div className="mt-2">
            <div className="risk-bar">
              <div className="risk-fill bg-[#00ff00]" style={{ width: "7%" }} />
            </div>
            <span className="text-[10px] text-[#7c8290] mt-1">Daily loss exposure</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Regime</span>
            <span className="metric-value text-[#ffff00]">BULL/BEAR</span>
            <span className="text-xs text-[#7c8290] font-mono">Long &amp; Short Enabled</span>
          </div>
        </Card>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 space-y-3">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290]">Watchlist</h2>
                <Badge variant="default">23 instruments</Badge>
              </div>
              <div className="overflow-hidden max-h-[220px]">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-16">Symbol</th>
                      <th className="text-right w-20">Price</th>
                      <th className="text-right w-20">Change</th>
                      <th className="text-right w-16">Regime</th>
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
                        <td className="py-1.5 text-right text-xs text-[#7c8290]">{w.reg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290]">Open Positions</h2>
                <Badge variant="default">{MOCK_POSITIONS.filter((p) => p.side !== "Pending").length} open</Badge>
              </div>
              <div className="overflow-hidden flex-1 min-h-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-16">Symbol</th>
                      <th className="w-16">Side</th>
                      <th className="text-right w-20">Entry</th>
                      <th className="text-right w-20">Stop</th>
                      <th className="text-right w-20">Target</th>
                      <th className="text-right w-20">P&L</th>
                      <th className="text-right w-20">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_POSITIONS.map((p) => (
                      <tr key={p.symbol} className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a] group">
                        <td className="py-1.5 font-mono">{p.symbol}</td>
                        <td className="py-1.5">
                          <Badge variant={p.side === "Long" ? "success" : p.side === "Short" ? "danger" : "default"}>
                            {p.side}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-right font-mono">{p.entry ? `$${p.entry.toFixed(2)}` : "—"}</td>
                        <td className="py-1.5 text-right font-mono">{p.stop ? `$${p.stop.toFixed(2)}` : "—"}</td>
                        <td className="py-1.5 text-right font-mono">{p.target ? `$${p.target.toFixed(2)}` : "—"}</td>
                        <td className={`py-1.5 text-right font-mono ${p.unrealized_pnl > 0 ? "text-[#00ff00]" : p.unrealized_pnl < 0 ? "text-[#ff0000]" : "text-[#7c8290]"}`}>
                          {p.unrealized_pnl > 0 ? "+" : ""}$${p.unrealized_pnl.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right font-mono text-[#7c8290]">{p.r_multiple}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Signal Pipeline</h2>
              <div className="flex gap-2">
                {[ "Scanner", "Signal", "Risk", "Exec", "Ops" ].map((stage, i) => (
                  <div key={stage} className="pipeline-stage">
                    <div className="pipeline-stage-name">{stage}</div>
                    <div className="pipeline-stage-count">{i === 0 ? "4" : i === 1 ? "6" : i === 2 ? "3" : i === 3 ? "2" : "2"}</div>
                    {i < 4 && <div className="pipeline-arrow">→</div>}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <Card>
              <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Risk Heatmap</h2>
              <div className="space-y-2">
                {[ { sector: "Technology", exposure: 34, limit: 50 }, { sector: "Healthcare", exposure: 12, limit: 50 }, { sector: "Financials", exposure: 8, limit: 50 } ].map((s) => (
                  <div key={s.sector} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span>{s.sector}</span>
                      <span className="font-mono">{s.exposure}%</span>
                    </div>
                    <div className="risk-bar">
                      <div className={`risk-fill ${s.exposure > s.limit ? "bg-[#ff0000]" : "bg-[#ffff00]"}`} style={{ width: `${Math.min((s.exposure / s.limit) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-[#7c8290] block mt-0.5">Limit {s.limit}%</span>
                  </div>
                ))}
                <div className="border-t border-[#1a1a1a] pt-2 mt-2">
                  <div className="flex justify-between text-[10px] text-[#7c8290]">
                    <span>Daily Loss Left</span>
                    <span className="font-mono">$1,850</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="flex-1 min-h-[200px]">
              <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Pending Signals</h2>
              <div className="space-y-2">
                {MOCK_SIGNALS.map((s) => (
                  <div key={s.symbol} className="p-2 rounded-[4px] border border-[#1a1a1a] bg-[#0a0a0a]/30">
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-xs">{s.symbol}</span>
                      <Badge variant="default">{s.setup_type.replace(/_/g, " ").toUpperCase()}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-[#7c8290] mb-1">
                      <span>{s.direction}</span>
                      <span className="font-mono">RR {s.rr_ratio}</span>
                      <span className="font-mono">Conf {Math.round(s.confidence * 100)}%</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => {}}>Approve</Button>
                      <Button variant="outline" size="sm" onClick={() => {}}>Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-12">
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290]">Agent Decision Log</h2>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full bg-[#00ff00]`} />
                  <span className="text-[10px] text-[#7c8290]">Live feed</span>
                </div>
              </div>
              <div className="h-[200px] overflow-y-auto font-mono text-[10px]">
                <div className="space-y-1">
                  <div className="log-entry">
                    <span className="log-time">[09:30:01]</span>
                    <span className="log-agent">Scanner</span>
                    <span className="log-msg">Market regime detected: BULL — 23 instruments passed filters</span>
                  </div>
                  <div className="log-entry">
                    <span className="log-time">[09:30:02]</span>
                    <span className="log-agent">Signal Gen</span>
                    <span className="log-msg">4 swing signals generated (2 long, 2 short candidates)</span>
                  </div>
                  <div className="log-entry">
                    <span className="log-time">[09:30:03]</span>
                    <span className="log-agent">Risk Mgmt</span>
                    <span className="log-msg">3 approved, 1 rejected (sector limit)</span>
                  </div>
                  <div className="log-entry">
                    <span className="log-time">[09:30:04]</span>
                    <span className="log-agent">Execution</span>
                    <span className="log-msg">2 paper fills executed (AAPL, NVDA)</span>
                  </div>
                  <div className="log-entry">
                    <span className="log-time">[09:30:05]</span>
                    <span className="log-agent">Ops</span>
                    <span className="log-msg">Equity $101,240.50 · Unrealized P&L +$757.00</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#1a1a1a] pt-2 pb-2 text-[10px] text-[#7c8290]">
        SwingPulse v0.2.0 — Long/Short Swing Trading. Agent pipeline: Scanner → Signal → Risk → Execution → Ops. Not financial advice.
      </footer>
    </div>
  )
}
