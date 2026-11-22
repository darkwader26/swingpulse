export interface Position {
  symbol: string
  side: 'long' | 'short' | 'flat'
  entry: number
  stop: number
  target: number
  qty: number
  unrealized_pnl: number
  r_multiple: number
  age: string
}

export interface Signal {
  symbol: string
  setup_type: string
  direction: 'long' | 'short'
  entry_price: number
  stop_price: number
  target_1: number
  rr_ratio: number
  confidence: number
}

export interface SectorExposure {
  sector: string
  exposure: number
  correlation: number
  limit: number
}

export interface Risk {
  daily_loss_percent: number
  daily_loss_limit: number
  open_positions: number
  max_positions: number
  sector_exposure: Record<string, number>
  kill_switch: boolean
}

export interface AgentStatusItem {
  status: string
  last_run?: string | null
  errors: number
}

export interface AgentStatus {
  scanner: AgentStatusItem
  signal_generator: AgentStatusItem
  risk_manager: AgentStatusItem
  executor: AgentStatusItem & { mode: string }
  ops: AgentStatusItem
}

export interface AgentEvent {
  agent_name: string
  event_type: string
  payload: unknown
  created_at: string
}

export interface Health {
  status: string
  service: string
  mode: string
}
