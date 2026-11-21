"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [agents, setAgents] = useState<AgentStatus | null>(null)
  const [risk, setRisk] = useState<Risk | null>(null)
  const [killSwitch, setKillSwitch] = useState(false)
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS)
  const [signals, setSignals] = useState<Signal[]>(MOCK_SIGNALS)
  const [logs, setLogs] = useState<string[]>([])

  const fetchStatus = useCallback(async () => {
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/agents/status`),
        fetch(`${API_BASE}/api/v1/risk`),
      ])
      if (aRes.ok) setAgents(await aRes.json())
      if (rRes.ok) setRisk(await rRes.json())
    } catch (e) {
      // API may not be running yet
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const toggleKillSwitch = () => setKillSwitch((prev) => !prev)

  const allOnline = agents
    ? Object.values(agents).every((a) => a.status === "active" || a.status === "standby")
    : true

  const dailyLoss = risk?.daily_loss_percent ?? 0
  const dailyLossLimit = risk?.daily_loss_limit ?? 0.02
  const riskPct = Math.min(Math.abs(dailyLoss) / dailyLossLimit, 1)

  const now = new Date()
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false })

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface/80 backdrop-blur pb-3 pt-2 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-accent flex items-center justify-center text-[#080a0f] font-bold text-sm">
              SP
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight">SwingPulse</span>
              <span className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Desk Terminal v0.2.0 — Long/Short</span>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-border pl-4 ml-3">
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono text-muted">{timeStr}</span>
              <span className="text-[10px] text-muted uppercase tracking-wider">UTC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="status-indicator">
            <span className={`status-dot ${allOnline ? "status-online" : "status-offline"}`} />
            <span className="text-xs font-mono">{allOnline ? "AGENTS ONLINE" : "AGENT ISSUE"}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-danger text-white font-bold text-xs tracking-wider killswitch {killSwitch ? "active" : ""}">
            <span className="dot"></span>
            <span>{killSwitch ? "SYSTEM HALTED" : "KILL SWITCH"}</span>
          </div>
          <Button onClick={toggleKillSwitch} variant="outline" className="px-2 py-1">
            {killSwitch ? "Restore" : "Halt"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Today P&L</span>
            <span className="metric-value">+$1,240.50</span>
            <span className="text-xs text-success font-mono">+1.24% · Win rate 62%</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Open Positions</span>
            <span className="metric-value">{risk?.open_positions ?? positions.length}</span>
            <span className="text-xs text-muted font-mono">Max {risk?.max_positions ?? 8}</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Daily Risk Left</span>
            <span className="metric-value">$1,850</span>
            <span className="text-xs text-muted font-mono">Limit: $2,000</span>
          </div>
          <div className="mt-2">
            <div className="risk-bar">
              <div
                className={`risk-fill ${riskPct > 0.8 ? "bg-danger" : riskPct > 0.5 ? "bg-warning" : "bg-success"}`}
                style={{ width: `${riskPct * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted mt-1">Daily loss exposure</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Regime</span>
            <span className="metric-value text-accent">BULL/BEAR</span>
            <span className="text-xs text-muted font-mono">Long &amp; Short Enabled</span>
          </div>
        </Card>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 space-y-3">
            <Card className="card-hover flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-muted">Watchlist</h2>
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
                      <tr key={w.sym} className="border-b border-surface-elev/50 hover:bg-surface-elev/30 transition-colors">
                        <td className="py-1.5 font-mono">{w.sym}</td>
                        <td className="py-1.5 text-right font-mono">${w.px.toFixed(2)}</td>
                        <td className={`py-1.5 text-right font-mono ${w.ch >= 0 ? "pos-long" : "pos-short"}`}>
                          {w.ch >= 0 ? "+" : ""}${w.ch.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right text-xs text-muted">{w.reg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <Card className="card-hover flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-muted">Open Positions</h2>
                <Badge variant="default">{positions.filter(p => p.side !== "Pending").length} open</Badge>
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
                    {positions.map((p) => (
                      <tr key={p.symbol} className="border-b border-surface-elev/50 hover:bg-surface-elev/30 transition-colors group">
                        <td className="py-1.5 font-mono">{p.symbol}</td>
                        <td className="py-1.5">
                          <Badge variant={p.side === "Long" ? "long" : p.side === "Short" ? "short" : "pending"}>
                            {p.side}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-right font-mono">{p.entry ? `$${p.entry.toFixed(2)}` : "—"}</td>
                        <td className="py-1.5 text-right font-mono">{p.stop ? `$${p.stop.toFixed(2)}` : "—"}</td>
                        <td className="py-1.5 text-right font-mono">{p.target ? `$${p.target.toFixed(2)}` : "—"}</td>
                        <td className={`py-1.5 text-right font-mono ${p.unrealized_pnl > 0 ? "pnl-pos" : p.unrealized_pnl < 0 ? "pnl-neg" : "pnl-neu"}`}>
                          {p.unrealized_pnl > 0 ? "+" : ""}$${p.unrealized_pnl.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right font-mono text-muted">{p.r_multiple}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="card-hover">
              <h2 className="text-[10px] uppercase tracking-wider text-muted mb-2">Signal Pipeline</h2>
              <div className="flex gap-2">
                {[
                  { label: "Scanner", count: signals.length.toString(), color: "text-accent" },
                  { label: "Signal", count: "6", color: "text-success" },
                  { label: "Risk", count: "3", color: "text-success" },
                  { label: "Exec", count: "2", color: "text-warning" },
                  { label: "Ops", count: "2", color: "text-success" },
                ].map((stage, i) => (
                  <div key={stage.label} className="pipeline-stage">
                    <div className="pipeline-stage-name">{stage.label}</div>
                    <div className="pipeline-stage-count">{stage.count}</div>
                    {i < 4 && <div className="pipeline-arrow">→</div>}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <Card className="card-hover">
              <h2 className="text-[10px] uppercase tracking-wider text-muted mb-2">Risk Heatmap</h2>
              <div className="space-y-2">
                {[
                  { sector: "Technology", exposure: 34, limit: 50 },
                  { sector: "Healthcare", exposure: 12, limit: 50 },
                  { sector: "Financials", exposure: 8, limit: 50 },
                ].map((s) => (
                  <div key={s.sector} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span>{s.sector}</span>
                      <span className="font-mono">{s.exposure}%</span>
                    </div>
                    <div className="risk-bar">
                      <div
                        className={`risk-fill ${s.exposure > s.limit ? "bg-danger" : "bg-accent"}`}
                        style={{ width: `${Math.min((s.exposure / s.limit) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted block mt-0.5">Limit {s.limit}%</span>
                  </div>
                ))}
                <div className="border-t border-surface-elev pt-2 mt-2">
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>Daily Loss Left</span>
                    <span className="font-mono">$1,850</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="card-hover flex-1 min-h-[200px]">
              <h2 className="text-[10px] uppercase tracking-wider text-muted mb-2">Pending Signals</h2>
              <div className="space-y-2">
                {signals.map((s) => (
                  <div key={s.symbol} className="p-2 rounded-[4px] border border-surface-elev bg-surface-elev/50">
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-xs">{s.symbol}</span>
                      <Badge variant="default">{s.setup_type.replace(/_/g, " ").toUpperCase()}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted mb-1">
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
            </Card>
          </div>
        </div>
      </div>

      <footer className="border-t border-surface-elev pt-2 pb-2 text-[10px] text-muted">
        SwingPulse v0.2.0 — Long/Short Swing Trading. Agent pipeline: Scanner → Signal → Risk → Execution → Ops. Not financial advice.
      </footer>
    </div>
  )
}
