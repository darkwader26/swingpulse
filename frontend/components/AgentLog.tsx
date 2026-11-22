import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AgentEvent } from './types'

interface AgentLogProps {
  initialEvents?: AgentEvent[]
  wsUrl?: string
}

export function AgentLog({ initialEvents = [], wsUrl }: AgentLogProps) {
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents)
  const [connected, setConnected] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = wsUrl || (typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : '') + '/ws/events'
    let socket: WebSocket | null = null

    try {
      socket = new WebSocket(url)
      socket.onopen = () => setConnected(true)
      socket.onclose = () => setConnected(false)
      socket.onerror = () => setConnected(false)
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
          // ignore malformed messages
        }
      }
    } catch {
      setConnected(false)
    }

    return () => {
      socket?.close()
    }
  }, [wsUrl])

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [events])

  const time = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return iso
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2>Agent Decision Log</h2>
        <span className={`text-xs font-semibold ${connected ? 'text-success' : 'text-muted'}`}>
          {connected ? '● Live' : '● Offline'}
        </span>
      </div>
      <div className="scroll" style={{ maxHeight: 420 }}>
        {events.length === 0 ? (
          <div className="text-muted p-4">No agent events yet</div>
        ) : (
          events.map((e) => (
            <div key={`${e.created_at}-${e.agent_name}`} className="log-entry">
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
