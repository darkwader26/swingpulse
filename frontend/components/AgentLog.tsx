import { useEffect, useRef, useState } from 'react'
import type { AgentEvent } from './types'

interface AgentLogProps {
  initialEvents?: AgentEvent[]
  wsUrl?: string
}

export function AgentLog({ initialEvents = [], wsUrl }: AgentLogProps) {
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents)
  const [connected, setConnected] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Polling-based agent log (replaces WebSocket — Vercel edge doesn't support WS)
  useEffect(() => {
    setConnected(true)
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/proxy/agents/logs', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const incoming: AgentEvent[] = Array.isArray(data) ? data : data.events || []
          if (incoming.length > 0) {
            setEvents((prev) => [...incoming, ...prev].slice(0, 200))
          }
        }
      } catch {
        setConnected(false)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [events])

  const time = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between mb-3 border-b border-border pb-1">
        <h2>AGENT DECISION LOG</h2>
        <span className={`text-xs font-bold mono ${connected ? 'text-success' : 'text-muted'}`}>
          {connected ? '● LIVE (POLLING)' : '● OFFLINE'}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll">
        {events.length === 0 ? (
          <div className="text-muted p-4 text-center">NO AGENT EVENTS YET</div>
        ) : (
          events.map((e) => (
            <div
              key={`${e.created_at}-${e.agent_name}-${Math.random()}`}
              className="log-entry"
            >
              <span className="log-time">{time(e.created_at)}</span>
              <span className="log-agent">{e.agent_name}</span>
              <span className="log-msg">{e.event_type}</span>
              {e.payload !== undefined && e.payload !== null && (
                <span className="log-json ml-2">{JSON.stringify(e.payload)}</span>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}