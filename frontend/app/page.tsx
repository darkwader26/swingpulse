"use client"

import { useEffect, useState, useCallback } from "react"
import { MoreHorizontal, Play, Stop, Activity, ShieldAlert, Clock, DollarSign } from "lucide-react"
import { Card, Metric, StatusDot, Badge, Button } from "@/components/ui"

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

export default function Dashboard() {
  const [agents, setAgents] = useState<AgentStatus | null>(null)
  const [risk, setRisk] = useState<Risk | null>(null)
  const [killSwitch, setKillSwitch] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/agents/status`),
        fetch(`${API_BASE}/api/v1/risk`),
      ])
      if (aRes.ok) setAgents(await aRes.json())
      if (rRes.ok) setRisk(await rRes.json())
    } catch (e) {
      // API may not be running yet in dev
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    try {
      const socket = new WebSocket(`${API_BASE.replace("http", "ws")}/ws/events`)
      socket.onopen = () => setWs(socket)
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          setLogs((prev) => [...prev.slice(-49), JSON.stringify(msg, null, 2)])
        } catch {}
      }
      socket.onclose = () => setWs(null)
      return () => socket.close()
    } catch {}
  }, [])

  const toggleKillSwitch = async () => {
    setKillSwitch((prev) => !prev)
  }

  const allOnline = agents
    ? Object.values(agents).every((a) => a.status === "active" || a.status === "standby")
    : false

  return (
    <div className="p-6 space-y-6 h-full">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-bold text-lg tracking-tight">SwingPulse</span>
          </div>
          <span className="text-xs text-muted uppercase tracking-wider">paper trading · v0.1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <StatusDot online={allOnline} />
            <span className="text-sm">{allOnline ? "All agents online" : "Agent issue"}</span>
          </div>
          <Button
            onClick={toggleKillSwitch}
            variant={killSwitch ? "default" : "outline"}
            className="bg-danger text-white border-danger hover:bg-danger/90"
          >
            {killSwitch ? "System Halted" : <><Stop size={16} /> Kill Switch</>}
          </Button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="metric">
            <span className="metric-label">Today P&L</span>
            <span className="metric-value">+$1,240.50</span>
            <span className="text-xs text-success font-mono">+1.24%</span>
          </div>
        </Card>
        <Card>
          <div className="metric">
            <span className="metric-label">Win Rate</span>
            <span className="metric-value">62%</span>
            <span className="text-xs text-muted font-mono">Last 50 trades</span>
          </div>
        </Card>
        <Card>
          <div className="metric">
            <span className="metric-label">Open Positions</span>
            <span className="metric-value">{risk?.open_positions ?? 4}</span>
            <span className="text-xs text-muted font-mono">Max {risk?.max_positions ?? 8}</span>
          </div>
        </Card>
        <Card>
          <div className="metric">
            <span className="metric-label">Daily Risk Left</span>
            <span className="metric-value">$1,850</span>
            <span className="text-xs text-muted font-mono">Limit: $2,000</span>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Watchlist + Equity */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <h2 className="text-xs uppercase tracking-wider text-muted mb-3">Watchlist</h2>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-1 text-muted">Symbol</th>
                    <th className="text-right pb-1 text-muted">Price</th>
                    <th className="text-right pb-1 text-muted">Change</th>
                    <th className="text-right pb-1 text-muted">Regime</th>
                  </tr>
                </thead>
                <tbody>
                  {["AAPL", "NVDA", "MSFT", "AMD", "TLT", "GLD"].map((sym) => (
                    <tr key={sym} className="border-b border-surface-elev hover:bg-surface-elev/50">
                      <td className="py-1 font-mono">{sym}</td>
                      <td className="py-1 text-right font-mono">$189.50</td>
                      <td className="py-1 text-right text-success">+1.24%</td>
                      <td className="py-1 text-right text-muted">Bull</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="h-64">
            <h2 className="text-xs uppercase tracking-wider text-muted mb-3">Equity Curve</h2>
            <div className="h-full flex items-center justify-center text-muted text-sm">
              Chart renders here — Recharts line series
            </div>
          </Card>
        </div>

        {/* Center: Positions + Pipeline */}
        <div className="lg:col-span-6 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-muted">Open Positions</h2>
              <Badge variant="success">4 open</Badge>
            </div>
            <div className="overflow-hidden max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-1 text-muted w-16">Symbol</th>
                    <th className="text-left pb-1 text-muted w-16">Side</th>
                    <th className="text-right pb-1 text-muted w-20">Entry</th>
                    <th className="text-right pb-1 text-muted w-20">Stop</th>
                    <th className="text-right pb-1 text-muted w-20">P&L</th>
                    <th className="text-right pb-1 text-muted w-20">R</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { sym: "AAPL", side: "Long", entry: 189.50, stop: 184.20, pnl: "+$442.00", r: "+0.83 R" },
                    { sym: "NVDA", side: "Long", entry: 872.00, stop: 845.00, pnl: "+$315.00", r: "+0.60 R" },
                    { sym: "TLT", side: "Short", entry: 92.40, stop: 94.10, pnl: "-$178.50", r: "-0.45 R" },
                    { sym: "MSFT", side: "Pending", entry: 0, stop: 0, pnl: "—", r: "—" },
                  ].map((p) => (
                    <tr key={p.sym} className="border-b border-surface-elev hover:bg-surface-elev/50">
                      <td className="py-1 font-mono">{p.sym}</td>
                      <td className="py-1"><Badge variant="default">{p.side}</Badge></td>
                      <td className="py-1 text-right font-mono">{p.entry ? `$${p.entry.toFixed(2)}` : "—"}</td>
                      <td className="py-1 text-right font-mono">{p.stop ? `$${p.stop.toFixed(2)}` : "—"}</td>
                      <td className="py-1 text-right font-mono">
                        {p.pnl.startsWith("+") ? <span className="text-success">{p.pnl}</span> : p.pnl.startsWith("-") ? <span className="text-danger">{p.pnl}</span> : <span className="text-muted">{p.pnl}</span>}
                      </td>
                      <td className="py-1 text-right font-mono text-muted">{p.r}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-xs uppercase tracking-wider text-muted mb-3">Signal Pipeline</h2>
            <div className="flex gap-2">
              {[
                { label: "Scanner", count: "42", color: "text-success" },
                { label: "Signal", count: "6", color: "text-success" },
                { label: "Risk", count: "3", color: "text-success" },
                { label: "Exec", count: "2", color: "text-warning" },
                { label: "Ops", count: "2", color: "text-success" },
              ].map((stage, i) => (
                <div key={stage.label} className="flex-1 bg-surface-elev border border-border rounded-sm p-2">
                  <div className="text-xs font-bold text-muted uppercase tracking-wider">{stage.label}</div>
                  <div className="text-lg font-mono font-bold">{stage.count}</div>
                  {i < 4 && <div className="text-xs text-muted mt-1">→</div>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Risk Heatmap + Agent Log */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <h2 className="text-xs uppercase tracking-wider text-muted mb-3">Risk Heatmap</h2>
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
                  <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        s.exposure > s.limit ? "bg-danger" : "bg-accent"
                      }`}
                      style={{ width: Math.min((s.exposure / s.limit) * 100, 100) + "%" }}
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

          <Card>
            <h2 className="text-xs uppercase tracking-wider text-muted mb-3">Agent Decision Log</h2>
            <div className="h-64 overflow-y-auto space-y-1 text-[11px] font-mono">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="text-muted truncate max-w-full">
                    {log.length > 120 ? log.slice(0, 120) + "…" : log}
                  </div>
                ))
              ) : (
                <div className="text-muted">Waiting for agent events…</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <footer className="border-t border-surface-elev pt-4 text-[10px] text-muted">
        SwingPulse v0.1.0 — Paper Trading. Agent pipeline: Scanner → Signal → Risk → Execution → Ops. Not financial advice.
      </footer>
    </div>
  )
}
