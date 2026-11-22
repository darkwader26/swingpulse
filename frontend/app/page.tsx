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

export default function Dashboard() {
  const [user, setUser] = useState<{ id?: string; email?: string; name?: string; picture?: string } | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [risk, setRisk] = useState<Risk>({
    daily_loss_percent: 0,
    daily_loss_limit: 0.02,
    open_positions: 0,
    max_positions: 8,
    sector_exposure: {},
    kill_switch: false,
  })
  const [agents, setAgents] = useState<AgentStatus>({
    scanner: { status: 'active', last_run: null, errors: 0 },
    signal_generator: { status: 'active', last_run: null, errors: 0 },
    risk_manager: { status: 'active', last_run: null, errors: 0 },
    executor: { status: 'standby', mode: 'paper', errors: 0 },
    ops: { status: 'active', last_run: null, errors: 0 },
  })
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [marketData, setMarketData] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [apiOk, setApiOk] = useState(true)
  const [time, setTime] = useState(new Date())
  const wsRef = useRef<WebSocket | null>(null)

  // Load saved user on startup (from Google OAuth)
  useEffect(() => {
    const saved = localStorage.getItem('swingpulse_user')
    if (saved) {
      try { setUser(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false }).padStart(8, '0')
  const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: '2-digit', weekday: 'short' }).toUpperCase()

  const fetchJson = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${PROXY_BASE}${path}`, { cache: 'no-store', ...opts })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }, [])

  const loadData = useCallback(async () => {
    const failures: string[] = []
    try {
      const [pos, sig, rsk, ags] = await Promise.all([
        fetchJson('/positions').catch((e) => { failures.push('positions'); return [] }),
        fetchJson('/signals').catch((e) => { failures.push('signals'); return [] }),
        fetchJson('/risk').catch((e) => { failures.push('risk'); return null }),
        fetchJson('/agents/status').catch((e) => { failures.push('agents/status'); return null }),
      ])
      setPositions(pos || [])
      setSignals(sig || [])
      if (rsk) setRisk(rsk)
      if (ags) setAgents(ags)
    } catch (e) {
      console.error('[SwingPulse] API load failed', e)
      setApiOk(false)
    } finally {
      if (failures.length) {
        console.error('[SwingPulse] Partial API failure:', failures)
        setApiOk(false)
      }
      setLoading(false)
    }
  }, [fetchJson])

  // Load historical market data for watchlist symbols (1+ month = 60 days minimum)
  const loadMarketData = useCallback(async () => {
    const symbols = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'META', 'AVGO', 'SPY', 'QQQ', 'TLT', 'COST']
    const data: Record<string, any[]> = {}
    for (const sym of symbols) {
      try {
        const hist = await fetchJson(`/market-data/${sym}/history?days=60`)
        data[sym] = hist.bars || []
      } catch {
        data[sym] = []
      }
    }
    setMarketData(data)
  }, [fetchJson])

  useEffect(() => {
    loadData()
    loadMarketData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData, loadMarketData])

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
    } catch { /* websocket unavailable */ }
    return () => { socket?.close() }
  }, [])

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0)
  const winRate = positions.length
    ? ((positions.filter((p) => p.unrealized_pnl > 0).length / positions.length) * 100).toFixed(0) + '%'
    : '—'

  // Equity curve from SPY historical market data (60 days)
  const spyBars = marketData['SPY']
  const equityData = spyBars?.map((bar, i) => ({
    t: new Date(bar.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    v: 10000 * (bar.close / (spyBars[0]?.close || bar.close)),
  })) || []

  // ── Save current chart snapshot (1+ month historical data) ──
  const saveChart = useCallback(async () => {
    if (!user?.id) return
    try {
      await fetchJson('/user/charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: `Chart ${new Date().toLocaleString()}`,
          symbols: Object.keys(marketData),
          regime: risk.kill_switch ? 'halted' : 'bull',
          market_data: marketData,
          signals,
          positions,
          risk,
        }),
      })
    } catch (e) {
      console.error('[SwingPulse] Save chart failed', e)
    }
  }, [user, marketData, signals, positions, risk, fetchJson])

  // ── Load a saved chart ──
  const loadSavedChart = useCallback(async (chartId: string) => {
    try {
      const chart = await fetchJson(`/user/charts/${chartId}`)
      setMarketData(chart.market_data || {})
      setSignals(chart.signals || [])
      setPositions(chart.positions || [])
      if (chart.risk) setRisk(chart.risk)
    } catch (e) {
      console.error('[SwingPulse] Load chart failed', e)
    }
  }, [fetchJson, risk])

  // ── List saved charts for user ──
  const [savedCharts, setSavedCharts] = useState<Array<{ id: string; name: string; updated_at: string }>>([])
  const refreshSavedCharts = useCallback(async () => {
    if (!user?.id) return
    try {
      const charts = await fetchJson(`/user/charts?user_id=${user.id}`)
      setSavedCharts(charts || [])
    } catch {
      setSavedCharts([])
    }
  }, [user, fetchJson])

  useEffect(() => {
    if (user?.id) refreshSavedCharts()
  }, [user, refreshSavedCharts])

  // ── Kill switch toggle ──
  const [killSwitchOn, setKillSwitchOn] = useState(risk.kill_switch)
  const handleKillSwitch = useCallback(async () => {
    setKillSwitchOn((prev) => {
      const next = !prev
      try {
        void fetchJson('/risk/kill-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kill_switch: next }),
        }).catch(() => { /* ignore */ })
      } catch { /* ignore */ }
      return next
    })
  }, [fetchJson])

  return (
    <div className="min-h-screen bg-bg text-ink font-sans antialiased desktop-bg" style={{ minHeight: '100vh', position: 'relative', zIndex: 0 }}>
      {/* Desktop Icons (left side, fixed) */}
      <div className="fixed top-16 left-4 flex flex-col gap-3 z-30 pointer-events-none">
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
      <div className="window max-w-none mx-auto mt-8 mb-8 h-[calc(100vh-100px)] z-10 relative overflow-hidden">
        <div className="window-titlebar">
          <span>SWINGPULSE v6.0 — COMMAND CENTER</span>
          <div className="window-controls">
            <div className="window-control" style={{ color: '#ff5f56' }}>●</div>
            <div className="window-control" style={{ color: '#ffbd2e' }}>●</div>
            <div className="window-control" style={{ color: '#27c93f' }}>●</div>
          </div>
        </div>
        <div className="window-body h-full flex flex-col overflow-hidden gap-0">

          {/* Row 1: Header Bar */}
          <header className="flex-shrink-0 border-b border-border pb-2 mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-extrabold tracking-widest text-glitch" data-text="SWINGPULSE">SWINGPULSE</span>
                <span className="text-[10px] font-bold text-muted border-l border-border pl-2">PAPER TRADING</span>
                {user && (
                  <span className="text-[10px] font-bold text-accent-long flex items-center gap-1.5">
                    <StatusDot status="online" /> {user.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold mono">
                <StatusDot status="online" />
                <span>AGENTS ONLINE</span>
                <span>{dateStr} &nbsp;|&nbsp; {timeStr} UTC</span>
                <button
                  onClick={handleKillSwitch}
                  className={`btn btn-xs px-2 py-0.5 border rounded-none ${killSwitchOn ? 'bg-danger text-white' : 'text-warning border-warning'}`}
                >
                  {killSwitchOn ? 'KILL: ON' : 'KILL SWITCH'}
                </button>
              </div>
            </div>
          </header>

          {/* Saved charts bar (user persistence) */}
          {user && (
            <div className="flex-shrink-0 px-2 py-1 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-label flex items-center gap-1 whitespace-nowrap">SAVED CHARTS</div>
                {savedCharts.length > 0 ? (
                  savedCharts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => loadSavedChart(c.id)}
                      className="btn btn-sm text-xs hover:bg-surface whitespace-nowrap"
                    >
                      {c.name}
                    </button>
                  ))
                ) : (
                  <span className="text-[10px] text-muted whitespace-nowrap">No saved charts</span>
                )}
                <button
                  onClick={saveChart}
                  className="btn btn-sm text-xs border-accent-long text-accent-long whitespace-nowrap"
                >
                  SAVE CURRENT (30 DAYS)
                </button>
              </div>
            </div>
          )}

          {/* Row 2 + Row 3: Three-Column Grid per DESIGN_SPEC.md Layout Composition */}
          <div className="dashboard-grid flex-1 min-h-0 overflow-hidden">
            {/* LEFT COLUMN — Watchlist (top) + Positions (bottom) */}
            <div className="flex flex-col h-full gap-1">
              <div className="office-room--main flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-wood">
                <div className="office-room-label">MAIN OFFICE — WATCHLIST</div>
                <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        <th className="text-left pb-1" style={{ width: '70px' }}>SYMBOL</th>
                        <th className="text-left pb-1" style={{ width: '80px' }}>PRICE</th>
                        <th className="text-left pb-1" style={{ width: '80px' }}>P&L</th>
                        <th className="text-left pb-1" style={{ width: '80px' }}>REGIME</th>
                        <th className="text-left pb-1">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.length > 0 ? (
                        positions.map((p) => (
                          <tr key={p.symbol}>
                            <td className="mono pb-1">{p.symbol}</td>
                            <td className="mono pb-1">${p.entry.toFixed(2)}</td>
                            <td className={`mono pb-1 ${pnlSign(p.unrealized_pnl)}`}>{p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toFixed(2)}</td>
                            <td className="text-muted pb-1">{regime(p.symbol)}</td>
                            <td><span className="badge badge-approved">OPEN</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-[10px] text-muted py-3 text-center">
                            <EmptyState title="NO WATCHLIST DATA" subtitle="Unable to load symbols from API" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="office-room--main flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-wood mt-1">
                <div className="office-room-label">MAIN OFFICE — POSITIONS</div>
                <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
                  <PositionsTable positions={positions} />
                </div>
              </div>
            </div>

            {/* CENTER COLUMN — Equity Curve + metrics (top) + Open Positions Table (bottom) */}
            <div className="flex flex-col h-full gap-1">
              <div className="office-room--conference flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-wall">
                <div className="office-room-label">CONFERENCE — COMMAND</div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2 p-1">
                  {/* Equity Curve */}
                  <div className="flex-1 min-h-0 overflow-hidden card p-2 flex flex-col">
                    <div className="flex-shrink-0 text-label mb-1">EQUITY CURVE (60 DAYS)</div>
                    <div className="flex-1 min-h-0 relative overflow-hidden">
                      <EquityCurve data={equityData} />
                    </div>
                  </div>
                  {/* Metrics Grid */}
                  <div className="flex-shrink-0 grid grid-cols-2 gap-2">
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
                </div>
              </div>

              <div className="office-room--conference flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-wall mt-1">
                <div className="office-room-label">CONFERENCE — POSITIONS TABLE</div>
                <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
                  <div className="text-[10px] mb-1 text-office-trim font-extrabold tracking-tighter">OPEN POSITIONS (DETAIL)</div>
                  <PositionsTable positions={positions} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Risk Heatmap (top) + Signal Pipeline (bottom) */}
            <div className="flex flex-col h-full gap-1">
              <div className="office-room--server flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-brick">
                <div className="office-room-label">SERVER ROOM — RISK</div>
                <div className="flex-1 min-h-0 overflow-hidden p-1">
                  <RiskHeatmap risk={risk} />
                </div>
              </div>

              <div className="office-room--server flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-brick mt-1">
                <div className="office-room-label">SERVER ROOM — SIGNAL PIPELINE</div>
                <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
                  <SignalQueue signals={signals} />
                </div>
              </div>
            </div>

            {/* AGENT RACKS — full-width band at bottom of grid */}
            <div className="office-room--server flex-shrink-0 overflow-hidden border border-office-trim bg-office-brick h-32">
              <div className="office-room-label">SERVER ROOM — AGENT RACKS</div>
              <div className="flex-1 min-h-0 p-1">
                <div className="office-server-grid flex-1 min-h-0 overflow-hidden">
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
            </div>
          </div>

          {/* Row 4: Agent Decision Log — full width */}
          <div className="flex-1 min-h-0 overflow-hidden mt-1">
            <div className="card h-full flex flex-col overflow-hidden">
              <div className="flex-shrink-0 text-[11px] mb-1 font-extrabold tracking-tighter uppercase">Agent Decision Log</div>
              <div className="flex-1 min-h-0 overflow-y-auto scroll">
                <AgentLog initialEvents={events} />
              </div>
            </div>
          </div>

          {/* Status strip */}
          <div className="flex-shrink-0 mt-1">
            {loading && <div className="text-[10px] text-muted mono">LOADING DATA FROM LIVE API…</div>}
            {!apiOk && <div className="text-[10px] text-warning mono">⚠ LIVE API UNREACHABLE — SHOWING CACHED/MOCK DATA</div>}
          </div>

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