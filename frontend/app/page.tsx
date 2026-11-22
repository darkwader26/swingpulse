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
import type {
  AgentEvent,
  AgentStatus,
  Position,
  Risk,
  Signal,
} from '../components/types'

const PROXY_BASE = '/api/proxy'

type View =
  | 'dashboard'
  | 'watchlist'
  | 'positions'
  | 'signals'
  | 'risk'
  | 'logs'
  | 'settings'

const VIEW_LABELS: Record<View, string> = {
  dashboard: 'DASHBOARD',
  watchlist: 'WATCHLIST',
  positions: 'POSITIONS',
  signals: 'SIGNALS',
  risk: 'RISK',
  logs: 'AGENT LOG',
  settings: 'SETTINGS',
}

const VIEW_ICONS: Record<View, string> = {
  dashboard: '▱',
  watchlist: '📊',
  positions: '📈',
  signals: '⚡',
  risk: '⚠',
  logs: '📜',
  settings: '⚙',
}

export default function Dashboard() {
  const [view, setView] = useState<View>('dashboard')
  const [user, setUser] = useState<{
    id?: string
    email?: string
    name?: string
    picture?: string
  } | null>(null)
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
  const [refreshing, setRefreshing] = useState(false)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [killSwitchOn, setKillSwitchOn] = useState(risk.kill_switch)
  const [time, setTime] = useState(new Date())
  const [pollTimer, setPollTimer] = useState<ReturnType<
    typeof setInterval
  > | null>(null)
  const [logPollTimer, setLogPollTimer] = useState<ReturnType<
    typeof setInterval
  > | null>(null)

  // ── Time ──
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', {
    hour12: false,
  }).padStart(8, '0')
  const dateStr = time
    .toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      weekday: 'short',
    })
    .toUpperCase()

  // ── Auth state (Google OAuth / localStorage) ──
  useEffect(() => {
    const saved = localStorage.getItem('swingpulse_user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        /* ignore */
      }
    }
  }, [])

  const login = (email: string, name: string, picture?: string) => {
    const u = { id: email, email, name, picture }
    setUser(u)
    localStorage.setItem('swingpulse_user', JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('swingpulse_user')
    setView('dashboard')
  }

  // ── API fetch ──
  const fetchJson = useCallback(
    async (path: string, opts?: RequestInit) => {
      const res = await fetch(`${PROXY_BASE}${path}`, {
        cache: 'no-store',
        ...opts,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    []
  )

  // ── Load all data ──
  const loadData = useCallback(async () => {
    const failures: string[] = []
    try {
      const [pos, sig, rsk, ags] = await Promise.all([
        fetchJson('/positions').catch((e) => {
          failures.push('positions')
          return []
        }),
        fetchJson('/signals').catch((e) => {
          failures.push('signals')
          return []
        }),
        fetchJson('/risk').catch((e) => {
          failures.push('risk')
          return null
        }),
        fetchJson('/agents/status').catch((e) => {
          failures.push('agents/status')
          return null
        }),
      ])
      setPositions(pos || [])
      setSignals(sig || [])
      if (rsk) {
        setRisk(rsk)
        setKillSwitchOn(!!rsk.kill_switch)
      }
      if (ags) setAgents(ags)
      setApiOk(failures.length === 0)
    } catch (e) {
      console.error('[SwingPulse] API load failed', e)
      setApiOk(false)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchJson])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    void loadData()
  }, [loadData])

  // ── Load historical market data (1+ month = 60 days) ──
  const loadMarketData = useCallback(async () => {
    const symbols = [
      'AAPL',
      'MSFT',
      'NVDA',
      'AMD',
      'GOOGL',
      'META',
      'AVGO',
      'SPY',
      'QQQ',
      'TLT',
      'COST',
      'TSLA',
      'AMZN',
      'NFLX',
      'CRM',
      'ADBE',
    ]
    const data: Record<string, any[]> = {}
    for (const sym of symbols) {
      try {
        const hist = await fetchJson(
          `/market-data/${sym}/history?days=60`
        )
        data[sym] = hist.bars || []
      } catch {
        data[sym] = []
      }
    }
    setMarketData(data)
  }, [fetchJson])

  // ── Trigger pipeline ──
  const handleRunPipeline = useCallback(async () => {
    setPipelineRunning(true)
    try {
      const result = await fetchJson('/pipeline/run', {
        method: 'POST',
      })
      console.log('[SwingPulse] Pipeline ran:', result)
      await loadData()
    } catch (e) {
      console.error('[SwingPulse] Pipeline run failed', e)
    } finally {
      setPipelineRunning(false)
    }
  }, [fetchJson, loadData])

  // ── Kill switch ──
  const handleKillSwitch = useCallback(async () => {
    const next = !killSwitchOn
    setKillSwitchOn(next)
    try {
      await fetchJson('/risk/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kill_switch: next }),
      })
      await loadData()
    } catch (e) {
      console.error('[SwingPulse] Kill switch failed', e)
      setKillSwitchOn(!next) // revert on failure
    }
  }, [killSwitchOn, fetchJson, loadData])

  // ── Saved charts ──
  const [savedCharts, setSavedCharts] = useState<
    Array<{ id: string; name: string; updated_at: string }>
  >([])
  const refreshSavedCharts = useCallback(async () => {
    if (!user?.id) return
    try {
      const charts = await fetchJson(
        `/user/charts?user_id=${user.id}`
      )
      setSavedCharts(charts || [])
    } catch {
      setSavedCharts([])
    }
  }, [user, fetchJson])

  useEffect(() => {
    if (user?.id) refreshSavedCharts()
  }, [user, refreshSavedCharts])

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
      await refreshSavedCharts()
    } catch (e) {
      console.error('[SwingPulse] Save chart failed', e)
    }
  }, [user, marketData, signals, positions, risk, fetchJson, refreshSavedCharts])

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

  // ── Polling: data every 15s, agent status every 5s ──
  useEffect(() => {
    loadData()
    loadMarketData()
    const dataTimer = setInterval(loadData, 15000)
    const statusTimer = setInterval(() => {
      void fetchJson('/agents/status').then((ags) => {
        setAgents(ags as AgentStatus)
      })
    }, 5000)
    setPollTimer(dataTimer)
    setLogPollTimer(statusTimer)
    return () => {
      clearInterval(dataTimer)
      clearInterval(statusTimer)
    }
  }, [loadData, loadMarketData, fetchJson])

  // ── Derived ──
  const totalUnrealized = positions.reduce(
    (sum, p) => sum + p.unrealized_pnl,
    0
  )
  const winRate = positions.length
    ? (
        (positions.filter((p) => p.unrealized_pnl > 0).length /
          positions.length) *
        100
      ).toFixed(0) + '%'
    : '—'

  const spyBars = marketData['SPY']
  const equityData = spyBars
    ? spyBars.map((bar, i) => ({
        t: new Date(bar.time).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        v: 10000 * (bar.close / (spyBars[0]?.close || bar.close)),
      }))
    : []

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault()
          handleRefresh()
          break
        case 'p':
          e.preventDefault()
          if (!pipelineRunning) handleRunPipeline()
          break
        case 'k':
          e.preventDefault()
          handleKillSwitch()
          break
        case '1':
          e.preventDefault()
          setView('dashboard')
          break
        case '2':
          e.preventDefault()
          setView('watchlist')
          break
        case '3':
          e.preventDefault()
          setView('positions')
          break
        case '4':
          e.preventDefault()
          setView('signals')
          break
        case '5':
          e.preventDefault()
          setView('risk')
          break
        case '6':
          e.preventDefault()
          setView('logs')
          break
        case '7':
          e.preventDefault()
          setView('settings')
          break
        case 'escape':
          setView('dashboard')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRefresh, handleRunPipeline, handleKillSwitch, pipelineRunning])

  // ── Navigation items ──
  const navItems: Array<{
    key: View
    label: string
    icon: string
    onClick: () => void
  }> = [
    {
      key: 'dashboard',
      label: 'DASHBOARD',
      icon: '▱',
      onClick: () => setView('dashboard'),
    },
    {
      key: 'watchlist',
      label: 'WATCHLIST',
      icon: '📊',
      onClick: () => setView('watchlist'),
    },
    {
      key: 'positions',
      label: 'POSITIONS',
      icon: '📈',
      onClick: () => setView('positions'),
    },
    {
      key: 'signals',
      label: 'SIGNALS',
      icon: '⚡',
      onClick: () => setView('signals'),
    },
    {
      key: 'risk',
      label: 'RISK',
      icon: '⚠',
      onClick: () => setView('risk'),
    },
    {
      key: 'logs',
      label: 'AGENT LOG',
      icon: '📜',
      onClick: () => setView('logs'),
    },
    {
      key: 'settings',
      label: 'SETTINGS',
      icon: '⚙',
      onClick: () => setView('settings'),
    },
  ]

  // ── View renderers ──
  const renderDashboard = () => (
    <div className="flex flex-col h-full gap-1">
      {/* Watchlist */}
      <div className="flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-wood">
        <div className="office-room-label">MAIN OFFICE — WATCHLIST</div>
        <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left pb-1" style={{ width: '70px' }}>
                  SYMBOL
                </th>
                <th className="text-left pb-1" style={{ width: '80px' }}>
                  PRICE
                </th>
                <th className="text-left pb-1" style={{ width: '80px' }}>
                  P&L
                </th>
                <th className="text-left pb-1" style={{ width: '80px' }}>
                  REGIME
                </th>
                <th className="text-left pb-1">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {positions.length > 0 ? (
                positions.map((p) => (
                  <tr key={p.symbol}>
                    <td className="mono pb-1">{p.symbol}</td>
                    <td className="mono pb-1">${p.entry.toFixed(2)}</td>
                    <td className={`mono pb-1 ${pnlSign(p.unrealized_pnl)}`}>
                      {p.unrealized_pnl >= 0 ? '+' : ''}
                      {p.unrealized_pnl.toFixed(2)}
                    </td>
                    <td className="text-muted pb-1">
                      {regime(p.symbol)}
                    </td>
                    <td>
                      <span className="badge badge-approved">OPEN</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-[10px] text-muted py-3 text-center">
                    <EmptyState
                      title="NO WATCHLIST DATA"
                      subtitle="Click REFRESH to load from live API"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Positions */}
      <div className="flex-1 min-h-0 overflow-hidden border border-office-trim bg-office-wood mt-1">
        <div className="office-room-label">MAIN OFFICE — POSITIONS</div>
        <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
          <PositionsTable positions={positions} />
        </div>
      </div>
    </div>
  )

  const renderWatchlist = () => (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-2">
        <div className="text-label">MARKET WATCHLIST</div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={loadMarketData}
            className="btn btn-sm border-accent-long text-accent-long"
            disabled={refreshing}
          >
            🔄 LOAD MARKET DATA (60 DAYS)
          </button>
          <span className={`text-[10px] mono ${apiOk ? 'text-success' : 'text-danger'}`}>
            {apiOk ? '● API LIVE' : '● API OFFLINE'}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-left pb-1" style={{ width: '70px' }}>
                SYMBOL
              </th>
              <th className="text-left pb-1" style={{ width: '90px' }}>
                PRICE
              </th>
              <th className="text-left pb-1" style={{ width: '90px' }}>
                CHANGE
              </th>
              <th className="text-left pb-1" style={{ width: '100px' }}>
                REGIME
              </th>
              <th className="text-left pb-1" style={{ width: '100px' }}>
                LAST BAR
              </th>
              <th className="text-left pb-1">BARS</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(marketData).length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[10px] text-muted py-6 text-center">
                  <EmptyState
                    title="NO MARKET DATA"
                    subtitle="Click LOAD MARKET DATA to fetch 60 days of history per symbol"
                  />
                </td>
              </tr>
            ) : (
              Object.entries(marketData).map(([symbol, bars]) => {
                const last = bars[bars.length - 1]
                const first = bars[0]
                const change = last && first
                  ? ((last.close - first.close) / first.close) * 100
                  : 0
                return (
                  <tr key={symbol}>
                    <td className="mono pb-1">{symbol}</td>
                    <td className="mono pb-1">
                      {last ? `$${last.close.toFixed(2)}` : '—'}
                    </td>
                    <td className={`mono pb-1 ${change >= 0 ? 'pos-long' : 'pos-short'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </td>
                    <td className="text-muted pb-1">{regime(symbol)}</td>
                    <td className="text-muted pb-1">
                      {last ? new Date(last.time).toLocaleDateString() : '—'}
                    </td>
                    <td className="mono pb-1">{bars.length}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderPositions = () => (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-2">
        <div className="text-label">OPEN POSITIONS</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted mono">
            {positions.length} OPEN
          </span>
          <span className="text-[10px] mono text-accent-long">
            PAPER TRADING
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll p-1">
        <PositionsTable positions={positions} />
      </div>
    </div>
  )

  const renderSignals = () => (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-2">
        <div className="text-label">SIGNAL PIPELINE</div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleRunPipeline}
            disabled={pipelineRunning}
            className={`btn btn-sm ${pipelineRunning ? 'opacity-50 cursor-not-allowed' : 'border-accent-long text-accent-long'}`}
          >
            {pipelineRunning ? 'RUNNING…' : 'RUN PIPELINE'}
          </button>
          <span className={`text-[10px] mono ${apiOk ? 'text-success' : 'text-danger'}`}>
            {apiOk ? '● LIVE' : '● OFFLINE'}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-1 overflow-hidden">
        <div className="card flex-1 min-h-0 p-2 overflow-hidden">
          <div className="text-label mb-2">PIPELINE STAGES</div>
          <div className="pipeline flex-1 min-h-0">
            {[ 'SCANNER', 'SIGNAL GEN', 'RISK MGMT', 'EXECUTION', 'OPS' ].map(
              (stage, i) => (
                <div
                  key={stage}
                  className="pipeline-stage"
                >
                  <div className="pipeline-stage-name">{stage}</div>
                  <div className="pipeline-stage-count mono">
                    {i === 0 ? agents.scanner.status.toUpperCase() : agents.signal_generator.status.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-muted">
                    {i === 0
                      ? `errors: ${agents.scanner.errors}`
                      : i === 1
                        ? `errors: ${agents.signal_generator.errors}`
                        : i === 2
                          ? `errors: ${agents.risk_manager.errors}`
                          : i === 3
                            ? `mode: ${agents.executor.mode}`
                            : `errors: ${agents.ops.errors}`}
                  </div>
                </div>
              )
            )}
            {[0, 1, 2, 3].map((i) => (
              <div key={`arrow-${i}`} className="pipeline-arrow">
                →
              </div>
            ))}
          </div>
        </div>
        <div className="card flex-1 min-h-0 overflow-y-auto scroll p-2">
          <div className="text-label mb-2">QUEUED SIGNALS</div>
          <SignalQueue signals={signals} />
        </div>
      </div>
    </div>
  )

  const renderRisk = () => (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-2">
        <div className="text-label">RISK MANAGEMENT</div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleKillSwitch}
            className={`btn btn-sm border rounded-none ${
              killSwitchOn
                ? 'bg-danger text-white border-danger'
                : 'text-warning border-warning'
            }`}
          >
            {killSwitchOn ? 'KILL: ON' : 'KILL SWITCH'}
          </button>
          <span className="text-[10px] text-muted mono">
            DAILY LOSS LIMIT: {(risk.daily_loss_limit * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-1">
        <RiskHeatmap risk={risk} />
      </div>
    </div>
  )

  const renderLogs = () => (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-2">
        <div className="text-label">AGENT DECISION LOG</div>
        <div className="flex items-center gap-2 mt-1">
          <StatusDot
            status={wsStatus('agents')}
            label="AGENTS STREAMING"
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <AgentLog initialEvents={events} />
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-4 p-4 border-b border-border">
        <div className="text-label mb-2">USER &amp; SETTINGS</div>
        {user ? (
          <div className="flex items-center gap-3 p-2 border border-surface bg-surface-elev">
            {user.picture ? (
              <img
                src={user.picture}
                alt="profile"
                className="w-8 h-8 border border-border object-cover"
              />
            ) : (
              <div className="w-8 h-8 border border-surface flex items-center justify-center text-[10px] font-bold">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <div className="text-[11px] font-bold">{user.name || user.email}</div>
              <div className="text-[9px] text-muted mono">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="btn btn-xs border-danger text-danger hover:bg-danger hover:text-black"
            >
              SIGN OUT
            </button>
          </div>
        ) : (
          <div className="p-2 border border-surface bg-surface-elev text-center">
            <div className="text-[11px] font-bold mb-1">NOT SIGNED IN</div>
            <button
              onClick={() => login('user@example.com', 'Trader')}
              className="btn btn-sm border-accent-long text-accent-long"
            >
              SIGN IN (DEMO)
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll p-4 space-y-4">
        <div className="card p-3 border border-border">
          <div className="text-label mb-2">TRADING MODE</div>
          <div className="flex items-center justify-between p-2 border border-surface bg-surface">
            <span className="text-[11px] text-muted">EXECUTION MODE</span>
            <span className="mono text-accent-long font-bold">PAPER</span>
          </div>
          <div className="text-[9px] text-muted mt-1">
            No live capital until Phase 5 validation proves positive expectancy.
          </div>
        </div>
        <div className="card p-3 border border-border">
          <div className="text-label mb-2">DATA RETENTION</div>
          <div className="flex items-center justify-between p-2 border border-surface bg-surface">
            <span className="text-[11px] text-muted">HISTORICAL BARS PER SYMBOL</span>
            <span className="mono text-accent-long font-bold">60 DAYS</span>
          </div>
          <div className="text-[9px] text-muted mt-1">
            Minimum 1 month of history stored per user for saved items.
          </div>
        </div>
        <div className="card p-3 border border-border">
          <div className="text-label mb-2">RISK LIMITS</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted">RISK PER TRADE</span>
              <span className="mono">0.5% of equity</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted">MAX POSITIONS</span>
              <span className="mono">{risk.max_positions}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted">MAX PER SECTOR</span>
              <span className="mono">2 positions</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted">DAILY LOSS LIMIT</span>
              <span className="mono">-2%</span>
            </div>
          </div>
        </div>
        <div className="card p-3 border border-border">
          <div className="text-label mb-2">SAVED CHARTS ({savedCharts.length})</div>
          {savedCharts.length === 0 ? (
            <div className="text-[10px] text-muted p-2 text-center">
              No saved charts. Sign in and save from the Dashboard view.
            </div>
          ) : (
            <div className="space-y-1">
              {savedCharts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-1 border border-surface bg-surface hover:bg-surface-elev cursor-pointer"
                  onClick={() => {
                    setView('dashboard')
                    void loadSavedChart(c.id)
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] mono">{c.name}</span>
                    <span className="text-[9px] text-muted mono">
                      {new Date(c.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[9px] text-accent-long mono">LOAD</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return renderDashboard()
      case 'watchlist':
        return renderWatchlist()
      case 'positions':
        return renderPositions()
      case 'signals':
        return renderSignals()
      case 'risk':
        return renderRisk()
      case 'logs':
        return renderLogs()
      case 'settings':
        return renderSettings()
      default:
        return renderDashboard()
    }
  }

  // ── wsStatus helper for logs view ──
  const wsStatus = (label: string): 'online' | 'offline' | 'error' => {
    return apiOk ? 'online' : 'offline'
  }

  const totalPositions = positions.length
  const totalSignals = signals.length

  return (
    <div
      className="min-h-screen bg-bg text-ink font-sans antialiased desktop-bg"
      style={{
        minHeight: '100vh',
        position: 'relative',
        zIndex: 0,
      }}
    >
      {/* Left Navigation Rail */}
      <div className="fixed top-16 left-4 flex flex-col gap-2 z-30 w-20 pointer-events-none">
        {navItems.map((item) => {
          const active = view === item.key
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`desktop-icon pointer-events-auto ${
                active ? 'selected' : ''
              }`}
              title={`${item.label} (${['1','2','3','4','5','6','7'][navItems.indexOf(item)]})`}
            >
              <div className="desktop-icon-icon">
                {item.icon}
              </div>
              <span className="text-[9px] leading-tight">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Window Frame */}
      <div className="window max-w-none mx-auto mt-8 mb-40 h-[calc(100vh-140px)] z-10 relative overflow-hidden">
        <div className="window-titlebar">
          <span className="flex items-center gap-2">
            <span className="text-glitch" data-text="SWINGPULSE">
              SWINGPULSE
            </span>
            <span className="text-[9px] text-muted mono">v6.0 COMMAND CENTER</span>
          </span>
          <div className="window-controls">
            <div className="window-control" style={{ color: '#ff5f56' }}>
              ●
            </div>
            <div className="window-control" style={{ color: '#ffbd2e' }}>
              ●
            </div>
            <div className="window-control" style={{ color: '#27c93f' }}>
              ●
            </div>
          </div>
        </div>

        <div className="window-body h-full flex flex-col overflow-hidden gap-0">
          {/* Header Bar */}
          <header className="flex-shrink-0 border-b border-border pb-2 mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold border-l border-border pl-2 ${
                  apiOk ? 'text-ok' : 'text-danger'
                }`}>
                  {apiOk ? 'PAPER TRADING • LIVE' : 'PAPER TRADING • OFFLINE'}
                </span>
                {user && (
                  <span className="text-[10px] font-bold text-accent-long flex items-center gap-1.5">
                    <StatusDot status="online" /> {user.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold mono">
                <StatusDot
                  status={apiOk ? 'online' : 'offline'}
                label={dateStr + ' | ' + timeStr + ' UTC'}
                />
                <button
                  onClick={handleKillSwitch}
                  disabled={pipelineRunning}
                  className={`btn btn-xs px-2 py-0.5 border rounded-none ${
                    killSwitchOn
                      ? 'bg-danger text-white border-danger'
                      : 'text-warning border-warning'
                  }`}
                >
                  {killSwitchOn ? 'KILL: ON' : 'KILL SWITCH'}
                </button>
                <button
                  onClick={handleRunPipeline}
                  disabled={pipelineRunning}
                  className={`btn btn-xs px-2 py-0.5 border rounded-none ${
                    pipelineRunning
                      ? 'opacity-50 cursor-not-allowed'
                      : 'border-accent-long text-accent-long hover:bg-accent-long hover:text-bg'
                  }`}
                >
                  {pipelineRunning ? 'RUNNING…' : 'RUN PIPELINE'}
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`btn btn-xs px-2 py-0.5 border rounded-none ${
                    refreshing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  🔄 REFRESH
                </button>
              </div>
            </div>
          </header>

          {/* Saved charts bar */}
          {user && (
            <div className="flex-shrink-0 px-2 py-1 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-label flex items-center gap-1 whitespace-nowrap">
                  SAVED CHARTS
                </div>
                {savedCharts.length > 0 ? (
                  savedCharts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setView('dashboard')
                        void loadSavedChart(c.id)
                      }}
                      className="btn btn-sm text-xs hover:bg-surface whitespace-nowrap"
                    >
                      {c.name}
                    </button>
                  ))
                ) : (
                  <span className="text-[10px] text-muted whitespace-nowrap">
                    No saved charts
                  </span>
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

          {/* Main content area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderView()}
          </div>

          {/* Status strip */}
          <div className="flex-shrink-0 mt-1 px-1">
            {loading && (
              <div className="text-[10px] text-muted mono">
                LOADING DATA FROM LIVE API…
              </div>
            )}
            {!apiOk && (
              <div className="text-[10px] text-warning mono">
                ⚠ LIVE API UNREACHABLE — SHOWING CACHED/MOCK DATA
              </div>
            )}
            <div className="flex justify-between text-[9px] text-muted mt-1">
              <span>
                POSITIONS: {totalPositions} &nbsp;|&nbsp;
                SIGNALS: {totalSignals} &nbsp;|&nbsp;
                KILL SWITCH: {killSwitchOn ? 'ON' : 'OFF'}
              </span>
              <span className="mono">
                CTRL+R REFRESH &nbsp;|&nbsp; CTRL+P PIPELINE &nbsp;|&nbsp; CTRL+K KILL &nbsp;|&nbsp; 1-7 NAV
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Start Bar */}
      <div className="start-bar z-50">
        <div className="start-button" onClick={() => setView('dashboard')}>
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
          <span>{VIEW_LABELS[view]}</span>
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
  const map: Record<string, string> = {
    AAPL: 'Bull',
    NVDA: 'Bull',
    TLT: 'Neutral',
    MSFT: 'Bull',
    AMD: 'Bull',
    SPY: 'Bull',
    QQQ: 'Bull',
  }
  return map[symbol] || 'Neutral'
}