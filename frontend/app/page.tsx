'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentLog } from '../components/AgentLog'
import { EmptyState } from '../components/EmptyState'
import { EquityCurve } from '../components/EquityCurve'
import { KillSwitch } from '../components/KillSwitch'
import { MetricCard } from '../components/MetricCard'
import { PositionsTable } from '../components/PositionsTable'
import { RiskHeatmap } from '../components/RiskHeatmap'
import { SignalQueue } from '../components/SignalQueue'
import { StatusDot } from '../components/StatusDot'
import type { AgentEvent, AgentStatus, Position, Risk, Signal } from '../components/types'

const PROXY_BASE = '/api/proxy'

const MOCK_POSITIONS: Position[] = [
  { symbol: 'AAPL', side: 'long', entry: 189.5, stop: 184.2, target: 196.8, qty: 340, unrealized_pnl: 442.0, r_multiple: 0.83, age: '2d 4h' },
  { symbol: 'NVDA', side: 'long', entry: 872.0, stop: 845.0, target: 915.0, qty: 45, unrealized_pnl: 315.0, r_multiple: 0.6, age: '1d 12h' },
  { symbol: 'TLT', side: 'short', entry: 92.4, stop: 94.1, target: 89.0, qty: 210, unrealized_pnl: -178.5, r_multiple: -0.45, age: '5d 2h' },
]

const MOCK_SIGNALS: Signal[] = [
  { symbol: 'MSFT', setup_type: 'Pullback to EMA', direction: 'long', entry_price: 418.3, stop_price: 409.0, target_1: 435.0, rr_ratio: 1.87, confidence: 82 },
  { symbol: 'AMD', setup_type: 'Breakout', direction: 'long', entry_price: 145.2, stop_price: 140.5, target_1: 154.0, rr_ratio: 1.69, confidence: 76 },
]

const MOCK_AGENTS: AgentStatus = {
  scanner: { status: 'active', last_run: new Date().toISOString(), errors: 0 },
  signal_generator: { status: 'active', last_run: new Date().toISOString(), errors: 0 },
  risk_manager: { status: 'active', last_run: new Date().toISOString(), errors: 0 },
  executor: { status: 'standby', mode: 'paper', errors: 0 },
  ops: { status: 'active', last_run: new Date().toISOString(), errors: 0 },
}

const MOCK_RISK: Risk = {
  daily_loss_percent: -0.84,
  daily_loss_limit: 0.02,
  open_positions: 3,
  max_positions: 8,
  sector_exposure: { Technology: 34, Healthcare: 12, Financials: 8, Energy: 5 },
  kill_switch: false,
}

const MOCK_EVENTS: AgentEvent[] = [
  { agent_name: 'Scanner', event_type: 'Regime: BULL — SPY > 200 EMA', payload: {}, created_at: new Date().toISOString() },
  { agent_name: 'Scanner', event_type: 'Watchlist: 42 instruments passed volume/ATR filter', payload: {}, created_at: new Date(Date.now() - 60000).toISOString() },
  { agent_name: 'Signal Gen', event_type: 'AAPL pullback to 20 EMA — entry $189.50', payload: {}, created_at: new Date(Date.now() - 120000).toISOString() },
  { agent_name: 'Risk Mgmt', event_type: 'APPROVED — 340 shares, risk $1,785 (0.89%)', payload: {}, created_at: new Date(Date.now() - 150000).toISOString() },
  { agent_name: 'Execution', event_type: 'Paper fill at $189.50 — order PAP-8842', payload: {}, created_at: new Date(Date.now() - 180000).toISOString() },
]

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [risk, setRisk] = useState<Risk>(MOCK_RISK)
  const [agents, setAgents] = useState<AgentStatus>(MOCK_AGENTS)
  const [events, setEvents] = useState<AgentEvent[]>(MOCK_EVENTS)
  const [loading, setLoading] = useState(true)
  const [apiOk, setApiOk] = useState(true)
  const [time, setTime] = useState(new Date())
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false }).padStart(8, '0')
  const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: '2-digit', weekday: 'short' }).toUpperCase()

  const fetchJson = useCallback(async (path: string) => {
    const res = await fetch(`${PROXY_BASE}${path}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }, [])

  const loadData = useCallback(async () => {
    const failures: string[] = []
    try {
      const [pos, sig, rsk, ags] = await Promise.all([
        fetchJson('/positions').catch((e) => { failures.push('positions'); return MOCK_POSITIONS }),
        fetchJson('/signals').catch((e) => { failures.push('signals'); return MOCK_SIGNALS }),
        fetchJson('/risk').catch((e) => { failures.push('risk'); return MOCK_RISK }),
        fetchJson('/agents/status').catch((e) => { failures.push('agents/status'); return MOCK_AGENTS }),
      ])
      setPositions(pos)
      setSignals(sig)
      setRisk(rsk)
      setAgents(ags)
    } catch (e) {
      console.error('[SwingPulse] API load failed, using mock data', e)
      setApiOk(false)
    } finally {
      if (failures.length) {
        console.error('[SwingPulse] Partial API failure, fell back to mock for:', failures)
        setApiOk(false)
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  // WebSocket for live agent log
  useEffect(() => {
    let socket: WebSocket | null = null
    try {
      const url = 'wss://swingpulse-api-1.onrender.com/ws/events'
      socket = new WebSocket(url)
      socket.onopen = () => { wsRef.current = socket }
      socket.onclose = () => { wsRef.current = null }
      socket.onerror = () => { wsRef.current = null }
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          const entry: AgentEvent = {
            agent_name: msg.agent_name ?? 'system',
            event_type: msg.event_type ?? 'event',
            payload: msg.payload,
            created_at: msg.created_at ?? new Date().toISOString(),
          }
          setEvents((prev) => [entry, ...prev].slice(0, 200))
        } catch { /* ignore malformed */ }
      }
    } catch { /* websocket unavailable — continue with mock events */ }
    return () => { socket?.close() }
  }, [])

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0)
  const winRate = positions.length
    ? ((positions.filter((p) => p.unrealized_pnl > 0).length / positions.length) * 100).toFixed(0) + '%'
    : '—'
  const dailyLossLeft = Math.max(0, risk.daily_loss_limit - Math.abs(risk.daily_loss_percent))

  const equityData = Array.from({ length: 30 }, (_, i) => ({
    t: `T${30 - i}`,
    v: 10000 + (totalUnrealized * (i / 29)) + (i * 12),
  })).reverse()

  return (
    <div className="min-h-screen bg-bg text-ink font-sans antialiased desktop-bg" style={{ minHeight: '100vh', position: 'relative', zIndex: 0 }}>
      {/* Desktop Icons (left side) */}
      <div className="fixed top-12 left-4 flex flex-col gap-4 z-20 pointer-events-none">
        <a href="#" className="desktop-icon selected pointer-events-auto">
          <div className="desktop-icon-icon">▨</div>
          <span>COMMAND</span>
        </a>
        <a href="#" className="desktop-icon pointer-events-auto">
          <div className="desktop-icon-icon">📊</div>
          <span>MARKETS</span>
        </a>
        <a href="#" className="desktop-icon pointer-events-auto">
          <div className="desktop-icon-icon">📁</div>
          <span>LOGS</span>
        </a>
        <a href="#" className="desktop-icon pointer-events-auto">
          <div className="desktop-icon-icon">⚙️</div>
          <span>SYS</span>
        </a>
      </div>

      {/* Main Window Frame */}
      <div className="window max-w-[1200px] mx-auto mt-8 mb-40 h-[calc(100vh-140px)] z-10 relative" style={{ minHeight: '600px' }}>
        <div className="window-titlebar">
          <span>SWINGPULSE v6.0 — COMMAND CENTER</span>
          <div className="window-controls">
            <div className="window-control" style={{ color: '#ff5f56' }}>●</div>
            <div className="window-control" style={{ color: '#ffbd2e' }}>●</div>
            <div className="window-control" style={{ color: '#27c93f' }}>●</div>
          </div>
        </div>
        <div className="window-body h-full flex flex-col gap-6">

          {/* Row 1: Header Bar */}
          <header className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[14px] font-extrabold tracking-widest text-glitch" data-text="SWINGPULSE">SWINGPULSE</span>
                <span className="text-xs font-bold text-muted border-l border-border pl-2">PAPER TRADING</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold mono">
                <StatusDot status="online" />
                <span>AGENTS ONLINE</span>
                <span>{dateStr} &nbsp;|&nbsp; {timeStr} UTC</span>
              </div>
            </div>
          </header>

          {/* Row 2: Three-Room Office Layout */}
          <div className="office-layout flex-1 min-h-0 gap-0">
            {/* ── Left Room: Open-plan Office (wood floor, navy desks) ── */}
            <div className="office-room--main flex flex-col gap-2">
              <div className="office-room-label">MAIN OFFICE</div>
              {/* Watchlist desks */}
              <h2 className="flex-shrink-0 text-xs mb-2 text-office-trim font-extrabold tracking-tighter">WATCHLIST</h2>
              <div className="flex-1 scroll min-h-0">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>SYMBOL</th>
                      <th style={{ width: '80px' }}>PRICE</th>
                      <th style={{ width: '80px' }}>P&L</th>
                      <th style={{ width: '80px' }}>REGIME</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length > 0 ? (
                      positions.map((p) => (
                        <tr key={p.symbol}>
                          <td className="mono">{p.symbol}</td>
                          <td className="mono">${p.entry.toFixed(2)}</td>
                          <td className={`mono ${pnlSign(p.unrealized_pnl)}`}>{p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toFixed(2)}</td>
                          <td className="text-muted">{regime(p.symbol)}</td>
                          <td><span className="badge badge-approved">OPEN</span></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-muted py-4 text-center">
                          <EmptyState title="NO WATCHLIST DATA" subtitle="Unable to load symbols" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Open positions as desk widgets */}
              <div className="mt-4 flex flex-col gap-2">
                <h2 className="flex-shrink-0 text-xs mb-2 text-office-trim font-extrabold tracking-tighter">OPEN POSITIONS</h2>
                <div className="flex-1 min-h-0">
                  <PositionsTable positions={positions} />
                </div>
              </div>
              {/* Plant decor */}
              <div className="mt-2 flex justify-end gap-2">
                <span className="office-plant" title="Ficus" />
                <span className="office-plant" title="Pothos" />
                <span className="office-plant" title="Snake" />
              </div>
            </div>

            {/* ── Middle Room ── */}
            <div className="flex flex-col gap-4">
              {/* Conference room (top) */}
              <div className="office-room--conference flex flex-col gap-2">
                <div className="office-room-label">CONFERENCE</div>
                <h2 className="flex-shrink-0 text-xs mb-2 text-office-trim font-extrabold tracking-tighter">COMMAND TABLE</h2>
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="office-conference-table relative">
                    <span className="absolute top-2 left-2 text-[10px] text-office-trim font-bold">SYSTEM STATUS</span>
                    <div className="text-[24px] font-black text-glitch" data-text="ONLINE">ONLINE</div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="card h-full p-2">
                      <div className="text-label mb-1">TODAY P&L</div>
                      <div className="metric-value">{totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}</div>
                      <div className={`metric-delta ${totalUnrealized >= 0 ? 'pos' : 'neg'}`}>{totalUnrealized >= 0 ? '+' : ''}${(totalUnrealized / 10000 * 100).toFixed(2)}%</div>
                    </div>
                    <div className="card h-full p-2">
                      <div className="text-label mb-1">WIN RATE</div>
                      <div className="metric-value">{winRate}</div>
                      <div className="metric-delta neu">LAST 50 TRADES</div>
                    </div>
                  </div>
                  <div className="mt-4 card h-full p-2 flex flex-col">
                    <div className="text-label mb-1">EQUITY CURVE</div>
                    <div className="flex-1 min-h-0 relative">
                      <EquityCurve data={equityData} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Purple lounge (bottom) - paper trading zone */}
              <div className="office-room--lounge flex flex-col gap-2 h-48">
                <div className="office-room-label">LOUNGE</div>
                <h2 className="flex-shrink-0 text-xs mb-2 text-office-trim font-extrabold tracking-tighter">PAPER TRADING LOUNGE</h2>
                <div className="flex-1 flex items-center justify-center gap-4">
                  <KillSwitch initial={risk.kill_switch} />
                  <div className="text-xs font-bold mono text-office-desk">
                    <span className="status-dot standby" />{' '}
                    SIMULATION MODE — NO LIVE CAPITAL
                  </div>
                </div>
                <div className="mt-2 flex justify-center gap-2">
                  <span className="office-plant" title="Ficus" />
                  <span className="office-plant" title="Pothos" />
                  <span className="office-plant" title="Snake" />
                </div>
              </div>
            </div>

            {/* ── Right Room: Server Room (grey brick) ── */}
            <div className="office-room--server flex flex-col gap-2">
              <div className="office-room-label">SERVER ROOM</div>
              <h2 className="flex-shrink-0 text-xs mb-2 text-office-trim font-extrabold tracking-tighter">AGENT RACKS</h2>
              <div className="flex-1 min-h-0">
                <div className="office-server-grid">
                  <div className="office-server-rack" title="Scanner">
                    <div className="office-server-rack-top" />
                    <span className="absolute top-5 left-1 right-1 text-[9px] text-center mono text-office-monitor">{agents.scanner.status}</span>
                  </div>
                  <div className="office-server-rack" title="Signal Gen">
                    <div className="office-server-rack-top" />
                    <span className="absolute top-5 left-1 right-1 text-[9px] text-center mono text-office-monitor">{agents.signal_generator.status}</span>
                  </div>
                  <div className="office-server-rack" title="Risk Mgmt">
                    <div className="office-server-rack-top" />
                    <span className="absolute top-5 left-1 right-1 text-[9px] text-center mono text-office-monitor">{agents.risk_manager.status}</span>
                  </div>
                  <div className="office-server-rack" title="Executor">
                    <div className="office-server-rack-top" />
                    <span className="absolute top-5 left-1 right-1 text-[9px] text-center mono text-office-monitor">{agents.executor.status}</span>
                  </div>
                  <div className="office-server-rack" title="Ops">
                    <div className="office-server-rack-top" />
                    <span className="absolute top-5 left-1 right-1 text-[9px] text-center mono text-office-monitor">{agents.ops.status}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 card h-full p-2 flex flex-col">
                <div className="text-label mb-1">RISK HEATMAP</div>
                <div className="flex-1 min-h-0">
                  <RiskHeatmap risk={risk} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Signal Pipeline */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-6">
              <div className="card h-full flex flex-col">
                <h2 className="flex-shrink-0">SIGNAL PIPELINE</h2>
                <div className="flex-1 scroll min-h-0">
                  <SignalQueue signals={signals} />
                </div>
              </div>
            </div>
            <div className="col-span-6">
              <div className="card h-full flex flex-col">
                <h2 className="flex-shrink-0">AGENT DECISION LOG</h2>
                <div className="flex-1 scroll min-h-0">
                  <AgentLog initialEvents={events} />
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="mt-2 text-xs text-muted mono">LOADING DATA FROM LIVE API…</div>
          )}
          {!apiOk && (
            <div className="mt-2 text-xs text-warning mono">⚠ LIVE API UNREACHABLE — SHOWING MOCK DATA</div>
          )}

        </div>
      </div>

      {/* Start Bar */}
      <div className="start-bar z-50">
        <div className="start-button">
          <span>▶</span>
          <span>START</span>
        </div>
        <div className="flex-1" />
        <div className="taskbar-item">
          <span>📡</span>
          <span>RENDER API</span>
        </div>
        <div className="taskbar-item active">
          <span>🖥️</span>
          <span>VERCEL DASHBOARD</span>
        </div>
        <div className="taskbar-clock">{timeStr}</div>
      </div>
    </div>
  )
}

function pnlSign(v: number) {
  return v > 0 ? 'pos-long' : v < 0 ? 'pos-short' : 'pos-flat'
}

function regime(symbol: string) {
  const map: Record<string, string> = { AAPL: 'Bull', NVDA: 'Bull', TLT: 'Neutral', MSFT: 'Bull', AMD: 'Bull' }
  return map[symbol] || 'Neutral'
}
