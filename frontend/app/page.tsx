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

const API_BASE = 'https://swingpulse-api-1.onrender.com/api/v1'

const MOCK_POSITIONS: Position[] = [
  {
    symbol: 'AAPL',
    side: 'long',
    entry: 189.5,
    stop: 184.2,
    target: 196.8,
    qty: 340,
    unrealized_pnl: 442.0,
    r_multiple: 0.83,
    age: '2d 4h',
  },
  {
    symbol: 'NVDA',
    side: 'long',
    entry: 872.0,
    stop: 845.0,
    target: 915.0,
    qty: 45,
    unrealized_pnl: 315.0,
    r_multiple: 0.6,
    age: '1d 12h',
  },
  {
    symbol: 'TLT',
    side: 'short',
    entry: 92.4,
    stop: 94.1,
    target: 89.0,
    qty: 210,
    unrealized_pnl: -178.5,
    r_multiple: -0.45,
    age: '5d 2h',
  },
]

const MOCK_SIGNALS: Signal[] = [
  {
    symbol: 'MSFT',
    setup_type: 'Pullback to EMA',
    direction: 'long',
    entry_price: 418.3,
    stop_price: 409.0,
    target_1: 435.0,
    rr_ratio: 1.87,
    confidence: 82,
  },
  {
    symbol: 'AMD',
    setup_type: 'Breakout',
    direction: 'long',
    entry_price: 145.2,
    stop_price: 140.5,
    target_1: 154.0,
    rr_ratio: 1.69,
    confidence: 76,
  },
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
  const wsRef = useRef<WebSocket | null>(null)

  const fetchJson = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' })
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
        } catch {
          // ignore malformed
        }
      }
    } catch {
      // websocket unavailable — continue with mock events
    }
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
    <div className="min-h-screen bg-bg text-ink font-sans antialiased" style={{ minHeight: '100vh' }}>
      {/* Row 1: Header */}
      <header className="border-b border-border pb-12 px-0">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-4 items-center px-4">
          <div className="col-span-2 text-[16px] font-semibold tracking-tight">
            SwingPulse
          </div>
          <div className="col-span-8 text-right">
            <div className="flex items-center justify-end gap-4">
              <span className="flex items-center gap-2 text-[12px]">
                <StatusDot status="online" />
                <span>All agents online</span>
              </span>
              <span className="text-xs text-muted ml-4">Paper trading mode</span>
            </div>
          </div>
          <div className="col-span-2">
            <KillSwitch initial={risk.kill_switch} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Row 2 */}
        <div className="grid grid-cols-12 gap-4 mb-6">
          {/* Col1: Watchlist */}
          <div className="col-span-3">
            <div className="card">
              <h2>Watchlist</h2>
              <div className="scroll" style={{ maxHeight: 420 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>Symbol</th>
                      <th style={{ width: '90px' }}>Price</th>
                      <th style={{ width: '80px' }}>Change</th>
                      <th style={{ width: '80px' }}>Regime</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length > 0 ? (
                      positions.map((p) => (
                        <tr key={p.symbol}>
                          <td className="mono">{p.symbol}</td>
                          <td className="mono">${p.entry.toFixed(2)}</td>
                          <td className={`mono ${pnlSign(p.unrealized_pnl)}`}>
                            {p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toFixed(2)}
                          </td>
                          <td className="text-muted">{regime(p.symbol)}</td>
                          <td>
                            <span className="badge badge-approved">Position Open</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-muted py-4 text-center">
                          <EmptyState title="No watchlist data" subtitle="Unable to load symbols" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Col2: Equity + Metrics */}
          <div className="col-span-6">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <MetricCard
                label="Today P&L"
                value={`${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`}
                delta={totalUnrealized >= 0 ? `+${(totalUnrealized / 10000 * 100).toFixed(2)}%` : `-${Math.abs(totalUnrealized / 10000 * 100).toFixed(2)}%`}
                deltaType={totalUnrealized >= 0 ? 'pos' : 'neg'}
                subLabel="Unrealized"
              />
              <MetricCard label="Win Rate" value={winRate} delta="Last 50 trades" deltaType="neu" />
              <MetricCard
                label="Open Positions"
                value={positions.length}
                delta={`Max ${risk.max_positions}`}
                deltaType="neu"
              />
              <MetricCard
                label="Daily Risk Left"
                value={`$${(dailyLossLeft * 10000).toFixed(0)}`}
                delta={`Limit: ${(risk.daily_loss_limit * 100).toFixed(0)}%`}
                deltaType={risk.kill_switch ? 'neg' : 'neu'}
              />
            </div>
            <EquityCurve data={equityData} />
          </div>

          {/* Col3: Risk Heatmap */}
          <div className="col-span-3">
            <RiskHeatmap risk={risk} />
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-12 gap-4">
          {/* Col1 empty/extends */}
          <div className="col-span-3 hidden lg:block" />

          {/* Col2: Open Positions Table */}
          <div className="col-span-6">
            <PositionsTable positions={positions} />
          </div>

          {/* Col3: Signal Pipeline */}
          <div className="col-span-3">
            <SignalQueue signals={signals} />
          </div>
        </div>

        {/* Bottom: Agent Log */}
        <div className="mt-6">
          <AgentLog initialEvents={events} />
        </div>

        {loading && (
          <div className="mt-4 text-xs text-muted">Loading data from live API…</div>
        )}
        {!apiOk && (
          <div className="mt-4 text-xs text-warning">
            ⚠ Live API unreachable — showing mock data. Check connection to {API_BASE}.
          </div>
        )}
      </main>
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
