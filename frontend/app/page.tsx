"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, Metric, StatusDot, Badge, Button } from "../components/ui"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts"

const GOOGLE_CLIENT_ID =
  "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" // Configure the real value in Google Cloud Console

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://swingpulse-api-1.onrender.com/api/v1/"

function getRedirectUri() {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/auth/callback`
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

interface AgentStatus {
  status: string
  last_run: string | null
  errors: string[]
}

interface AgentsStatus {
  scanner: AgentStatus
  signal_generator: AgentStatus
  risk_manager: AgentStatus
  executor: AgentStatus
  ops: AgentStatus
}

interface Risk {
  daily_loss_percent: number
  daily_loss_limit: number
  open_positions: number
  max_positions: number
  sector_exposure: Record<string, number>
  kill_switch: boolean
}

interface LogEntry {
  id: string
  timestamp: string
  agent_name: string
  event_type: string
  message: string
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

const MOCK_WATCHLIST = [
  { sym: "AAPL", px: 189.50, ch: +1.24, reg: "Bull" },
  { sym: "NVDA", px: 872.00, ch: +2.10, reg: "Bull" },
  { sym: "MSFT", px: 418.30, ch: -0.45, reg: "Bull" },
  { sym: "AMD", px: 145.20, ch: +0.88, reg: "Bull" },
  { sym: "TLT", px: 92.40, ch: -1.10, reg: "Neutral" },
  { sym: "GLD", px: 231.50, ch: +0.32, reg: "Neutral" },
  { sym: "EEM", px: 41.80, ch: -0.15, reg: "Bear" },
  { sym: "SLV", px: 28.90, ch: +0.45, reg: "Neutral" },
]

// Mock equity curve: 30 points starting at 100000, walking forward with small random
// variations, ending near ~101240. Seeded deterministically so the line is stable.
const MOCK_EQUITY: { time: string; equity: number }[] = (() => {
  const points: { time: string; equity: number }[] = []
  let equity = 100000
  let seed = 12345
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return (seed / 0x7fffffff) * 2 - 1 // [-1, 1]
  }
  const base = new Date(Date.UTC(2026, 0, 1))
  for (let i = 0; i < 30; i++) {
    if (i > 0) equity += 250 + next() * 600
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    points.push({ time: d.toISOString().slice(0, 10), equity })
  }
  return points
})()

// Daily P&L for the last 7 days - mix of positive and negative.
const MOCK_DAILY_PNL: { day: string; pnl: number }[] = [
  { day: "Mon", pnl: +240 },
  { day: "Tue", pnl: -150 },
  { day: "Wed", pnl: +320 },
  { day: "Thu", pnl: -80 },
  { day: "Fri", pnl: +410 },
  { day: "Sat", pnl: -200 },
  { day: "Sun", pnl: +180 },
]

// Regime history: 30 points, bull=1 / bear=-1 / chop=0.
const MOCK_REGIME: { time: string; regime: number }[] = (() => {
  const points: { time: string; regime: number }[] = []
  const base = new Date(Date.UTC(2026, 0, 1))
  const pattern = [1, 1, 1, 1, 0, 0, -1, -1, 1, 1, 0, -1, -1, -1, 0]
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    points.push({ time: d.toISOString().slice(0, 10), regime: pattern[i % pattern.length] })
  }
  return points
})()

const CHART_TITLE_STYLE = "text-[10px] uppercase tracking-wider text-[#7c8290] font-mono mb-1"

function EquityCurve() {
  return (
    <Card className="flex-1 min-h-[260px]">
      <h2 className={CHART_TITLE_STYLE}>Equity Curve</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={MOCK_EQUITY}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#7c8290", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#7c8290", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                const { value } = payload[0]
                return (
                  <div className="bg-[#0a0a0a] border border-[#00ff00] p-2 text-[10px] font-mono text-[#00ff00]">
                    {value.time}: ${value.equity.toLocaleString()}
                  </div>
                )
              }
              return null
            }}
          />
          <Line type="monotone" dataKey="equity" stroke="#00ff00" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

function DailyPnL() {
  return (
    <Card className="flex-1 min-h-[260px]">
      <h2 className={CHART_TITLE_STYLE}>Daily P&L</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={MOCK_DAILY_PNL}>
          <CartesianGrid stroke="#1a1a1a" />
          <ReferenceLine x={0} stroke="#00ff00" strokeWidth={1} />
          <XAxis
            dataKey="day"
            tick={{ fill: "#7c8290", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#7c8290", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                const { value } = payload[0]
                return (
                  <div className="bg-[#0a0a0a] border border-[#00ff00] p-2 text-[10px] font-mono text-[#00ff00]">
                    {value.day}: ${value.pnl >= 0 ? "+" : ""}${value.pnl}
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="pnl" fill="#00ff00" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function RegimeHistory() {
  return (
    <Card className="flex-1 min-h-[260px]">
      <h2 className={CHART_TITLE_STYLE}>Regime History</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={MOCK_REGIME}>
          <CartesianGrid stroke="#1a1a1a" />
          <ReferenceLine y={0} stroke="#7c8290" strokeWidth={1} strokeDasharray="2 2" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#7c8290", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[-1.5, 1.5]}
            tick={{ fill: "#7c8290", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v === 1 ? "BULL" : v === -1 ? "BEAR" : "CHOP")}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                const { value } = payload[0]
                const label = value.regime === 1 ? "BULL" : value.regime === -1 ? "BEAR" : "CHOP"
                return (
                  <div className="bg-[#0a0a0a] border border-[#00ff00] p-2 text-[10px] font-mono text-[#00ff00]">
                    {value.time}: {label}
                  </div>
                )
              }
              return null
            }}
          />
          <Line type="step" dataKey="regime" stroke="#00ff00" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

export default function Dashboard() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState<{ name: string; email: string; picture?: string } | null>(null)
  const [terminalInput, setTerminalInput] = useState("")
  const [terminalLines, setTerminalLines] = useState([
    "C:\\SWINGPULSE> SYSTEM INITIALIZED",
    "C:\\SWINGPULSE> LOADING MODULES...",
    "C:\\SWINGPULSE> MARKET DATA CONNECTED",
    "C:\\SWINGPULSE> AGENT PIPELINE READY",
    "C:\\SWINGPULSE> AWAITING USER LOGON",
  ])
  const [killSwitch, setKillSwitch] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [risk, setRisk] = useState<Risk | null>(null)
  const [agents, setAgents] = useState<AgentsStatus | null>(null)
  const [loading, setLoading] = useState({ positions: true, signals: true, risk: true, agents: true })
  const terminalRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("closed")
  const wsUrl = "wss://swingpulse-api-1.onrender.com/ws/events"

  const handleGoogleLogin = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  const handleLogout = () => {
    localStorage.removeItem("swingpulse_token")
    localStorage.removeItem("swingpulse_user")
    setLoggedIn(false)
    setUser(null)
    setKillSwitch(false)
    setTerminalLines((prev) => [
      ...prev,
      "C:\\SWINGPULSE> USER LOGGED OUT",
    ])
  }

  useEffect(() => {
    const token = localStorage.getItem("swingpulse_token")
    const userJson = localStorage.getItem("swingpulse_user")
    if (token && userJson) {
      try {
        setUser(JSON.parse(userJson))
        setLoggedIn(true)
      } catch {
        // Ignore malformed stored user
      }
    }
  }, [])

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

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logEntries])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const [posRes, sigRes, riskRes, agentsRes] = await Promise.allSettled([
          fetchJson<Position[]>("positions"),
          fetchJson<Signal[]>("signals"),
          fetchJson<Risk>("risk"),
          fetchJson<AgentsStatus>("agents/status"),
        ])

        if (!mounted) return

        if (posRes.status === "fulfilled") {
          setPositions(posRes.value)
        } else {
          console.error("SwingPulse: failed to load positions", posRes.reason)
        }
        if (sigRes.status === "fulfilled") {
          setSignals(sigRes.value)
        } else {
          console.error("SwingPulse: failed to load signals", sigRes.reason)
        }
        if (riskRes.status === "fulfilled") {
          setRisk(riskRes.value)
        } else {
          console.error("SwingPulse: failed to load risk", riskRes.reason)
        }
        if (agentsRes.status === "fulfilled") {
          setAgents(agentsRes.value)
        } else {
          console.error("SwingPulse: failed to load agents status", agentsRes.reason)
        }

        setLoading({ positions: false, signals: false, risk: false, agents: false })
      } catch (err) {
        console.error("SwingPulse: data load error", err)
        if (mounted) {
          setLoading({ positions: false, signals: false, risk: false, agents: false })
        }
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let ws: WebSocket | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    const reconnectDelayMs = 3000
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (!mounted) return
      setWsStatus("connecting")
      try {
        ws = new WebSocket(wsUrl)
      } catch (err) {
        console.error("SwingPulse: failed to create WebSocket", err)
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        if (!mounted) return
        setWsStatus("open")
        reconnectAttempts = 0
      }

      ws.onmessage = (event: MessageEvent) => {
        if (!mounted) return
        try {
          const data = JSON.parse(event.data)
          const entry: LogEntry = {
            id: data.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            timestamp: data.timestamp ?? new Date().toLocaleTimeString("en-US", { hour12: false }),
            agent_name: data.agent_name ?? "Unknown",
            event_type: data.event_type ?? "event",
            message: data.message ?? data.payload ?? JSON.stringify(data),
          }
          setLogEntries((prev) => [entry, ...prev].slice(0, 200))
        } catch (err) {
          console.error("SwingPulse: failed to parse WebSocket message", err)
        }
      }

      ws.onerror = (err: Event) => {
        if (!mounted) return
        console.error("SwingPulse: WebSocket error", err)
        ws?.close()
      }

      ws.onclose = () => {
        if (!mounted) return
        setWsStatus("closed")
        if (reconnectAttempts < maxReconnectAttempts) {
          scheduleReconnect()
        }
      }
    }

    function scheduleReconnect() {
      if (!mounted) return
      reconnectAttempts += 1
      setWsStatus("connecting")
      reconnectTimer = setTimeout(() => {
        if (!mounted) return
        connect()
      }, reconnectDelayMs)
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  // Fall back to mock data when the API is unavailable or still loading.
  const displayPositions = loading.positions ? [] : (positions.length ? positions : MOCK_POSITIONS)
  const displaySignals = loading.signals ? [] : (signals.length ? signals : MOCK_SIGNALS)

  // Watchlist derives its symbols from positions/signals when the API has no
  // dedicated watchlist endpoint; falls back to the mock watchlist otherwise.
  const watchlist = useMemo(() => {
    const symbols = Array.from(new Set([...positions.map((p) => p.symbol), ...signals.map((s) => s.symbol)]))
    if (symbols.length === 0) return MOCK_WATCHLIST
    return symbols.map((sym) => {
      const pos = positions.find((p) => p.symbol === sym)
      const sig = signals.find((s) => s.symbol === sym)
      const px = pos?.entry ?? sig?.entry_price ?? 0
      const reg =
        pos?.side === "Long" || sig?.direction === "long"
          ? "Bull"
          : pos?.side === "Short" || sig?.direction === "short"
            ? "Bear"
            : "Neutral"
      return { sym, px, ch: 0, reg }
    })
  }, [positions, signals])

  const totalPnl = displayPositions.reduce((sum, p) => sum + p.unrealized_pnl, 0)
  const openPositions = displayPositions.filter((p) => p.side !== "Pending").length

  const stageLabels: Record<string, string> = {
    scanner: "Scanner",
    signal_generator: "Signal",
    risk_manager: "Risk",
    executor: "Exec",
    ops: "Ops",
  }

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
          <div className="flex items-center gap-4 border-l border-[#00ff00]/30 pl-4 ml-3">
            <div className="flex flex-col items-end">
              {user ? (
                <>
                  <span className="text-xs font-mono text-[#00ff00]">{user.name}</span>
                  <span className="text-[9px] text-[#7c8290] uppercase tracking-wider">{user.email}</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-mono text-[#7c8290]">{timeStr}</span>
                  <span className="text-[10px] text-[#7c8290] uppercase tracking-wider">UTC</span>
                </>
              )}
            </div>
            {user && (
              <Button onClick={handleLogout} variant="outline" className="px-2 py-1 text-xs border-[#ff0000] text-[#ff0000] hover:bg-[#ff0000] hover:text-[#000000]">
                LOGOUT
              </Button>
            )}
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
            <span className="metric-value">{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</span>
            <span className={`text-xs font-mono ${totalPnl >= 0 ? "text-[#00ff00]" : "text-[#ff0000]"}`}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} · {openPositions} open
            </span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Open Positions</span>
            <span className="metric-value">{openPositions}</span>
            <span className="text-xs text-[#7c8290] font-mono">Max 8</span>
          </div>
        </Card>
        <Card className="card-hover">
          <div className="metric">
            <span className="metric-label">Daily Risk Left</span>
            <span className="metric-value">{risk ? `$${risk.daily_loss_limit.toFixed(0)}` : "$1,850"}</span>
            <span className="text-xs text-[#7c8290] font-mono">Limit: $2,000</span>
          </div>
          <div className="mt-2">
            <div className="risk-bar">
              <div className="risk-fill bg-[#00ff00]" style={{ width: risk ? `${Math.min((risk.daily_loss_percent / risk.daily_loss_limit) * 100, 100)}%` : "7%" }} />
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

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <EquityCurve />
        <DailyPnL />
        <RegimeHistory />
      </div>

      <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 space-y-3">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290]">Watchlist</h2>
                <Badge variant="default">{watchlist.length} instruments</Badge>
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
                    {(loading.positions || loading.signals) && watchlist.length === 0 ? (
                      <tr key="loading">
                        <td colSpan={4} className="py-1.5 text-[10px] text-[#7c8290]">
                          Loading watchlist...
                        </td>
                      </tr>
                    ) : (
                      watchlist.map((w) => (
                        <tr key={w.sym} className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a]">
                          <td className="py-1.5 font-mono">{w.sym}</td>
                          <td className="py-1.5 text-right font-mono">${w.px.toFixed(2)}</td>
                          <td className={`py-1.5 text-right font-mono ${w.reg === "Bull" ? "text-[#00ff00]" : w.reg === "Bear" ? "text-[#ff0000]" : "text-[#7c8290]"}`}>
                            {w.ch >= 0 ? "+" : ""}${w.ch.toFixed(2)}
                          </td>
                          <td className="py-1.5 text-right text-xs text-[#7c8290]">{w.reg}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290]">Open Positions</h2>
                <Badge variant="default">{openPositions} open</Badge>
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
                    {loading.positions && displayPositions.length === 0 ? (
                      <tr key="loading">
                        <td colSpan={7} className="py-1.5 text-[10px] text-[#7c8290]">
                          Loading positions...
                        </td>
                      </tr>
                    ) : (
                      displayPositions.map((p) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Signal Pipeline</h2>
              <div className="flex gap-2">
                {loading.agents ? (
                  <div className="pipeline-stage">
                    <div className="pipeline-stage-name">Loading…</div>
                    <div className="pipeline-stage-count">—</div>
                  </div>
                ) : (
                  Object.entries(agents ?? {}).map(([key, agent]) => (
                    <div key={key} className="pipeline-stage">
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${agent.status === "online" ? "bg-[#00ff00]" : "bg-[#ff0000]"}`}
                        ></span>
                        <div className="pipeline-stage-name">{stageLabels[key] ?? key}</div>
                      </div>
                      <div className="pipeline-stage-count">{agent.errors.length}</div>
                      {key !== "ops" && <div className="pipeline-arrow">→</div>}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <Card>
              <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Risk Heatmap</h2>
              <div className="space-y-2">
                {risk ? (
                  Object.entries(risk.sector_exposure).map(([sector, exposure]) => (
                    <div key={sector} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span>{sector}</span>
                        <span className="font-mono">{exposure}%</span>
                      </div>
                      <div className="risk-bar">
                        <div
                          className={`risk-fill ${exposure > 50 ? "bg-[#ff0000]" : "bg-[#ffff00]"}`}
                          style={{ width: `${Math.min((exposure / 50) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#7c8290] block mt-0.5">Limit 50%</span>
                    </div>
                  ))
                ) : (
                  loading.risk ? (
                    <div className="text-[10px] text-[#7c8290]">Loading risk data…</div>
                  ) : (
                    [
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
                          <div className={`risk-fill ${s.exposure > s.limit ? "bg-[#ff0000]" : "bg-[#ffff00]"}`} style={{ width: `${Math.min((s.exposure / s.limit) * 100, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-[#7c8290] block mt-0.5">Limit {s.limit}%</span>
                      </div>
                    ))
                  )
                )}
                <div className="border-t border-[#1a1a1a] pt-2 mt-2">
                  <div className="flex justify-between text-[10px] text-[#7c8290]">
                    <span>Daily Loss Left</span>
                    <span className="font-mono">{risk ? `$${Math.max(0, risk.daily_loss_limit - risk.daily_loss_percent).toFixed(0)}` : "$1,850"}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="flex-1 min-h-[200px]">
              <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290] mb-2">Pending Signals</h2>
              <div className="space-y-2">
                {loading.signals && displaySignals.length === 0 ? (
                  <div className="text-[10px] text-[#7c8290]">Loading signals…</div>
                ) : (
                  displaySignals.map((s) => (
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
                        <Button variant="outline" size="sm" onClick={() => {}}>
                          Approve
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {}}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-12">
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] uppercase tracking-wider text-[#7c8290]">Agent Decision Log</h2>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === "open" ? "bg-[#00ff00]" : wsStatus === "closed" ? "bg-[#ff0000]" : "bg-[#ffff00]"}`} />
                  <span className={`text-[10px] text-[#7c8290] font-mono`}>
                    {wsStatus === "open" ? "Live" : wsStatus === "closed" ? "Disconnected" : "Connecting…"}
                  </span>
                </div>
              </div>
              <div className="h-[200px] overflow-y-auto font-mono text-[10px]" ref={logRef}>
                <div className="space-y-1">
                  {logEntries.length === 0 ? (
                    <div className="log-entry text-[#7c8290]">
                      Waiting for agent events…
                    </div>
                  ) : (
                    logEntries.map((entry) => (
                      <div key={entry.id} className="log-entry">
                        <span className="log-time">[{entry.timestamp}]</span>
                        <span className="log-agent">{entry.agent_name}</span>
                        <span className="log-msg">{entry.event_type} — {entry.message}</span>
                      </div>
                    ))
                  )}
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
