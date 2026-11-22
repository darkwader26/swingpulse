import type { Signal } from './types'

const STAGES = [
  { key: 'scanner', label: 'SCANNER', sub: 'Universe filtered' },
  { key: 'signal_generator', label: 'SIGNAL GEN', sub: 'Setups detected' },
  { key: 'risk_manager', label: 'RISK MGMT', sub: 'Approved sized' },
  { key: 'executor', label: 'EXECUTION', sub: 'Fills sent' },
  { key: 'ops', label: 'OPS', sub: 'Journal closed' },
]

export function SignalQueue({ signals }: SignalQueueProps) {
  const counts: number[] = STAGES.map(() => 0)
  signals.forEach((_, i) => {
    const stage = Math.min(i, STAGES.length - 1)
    counts[stage] += 1
  })

  return (
    <div className="card h-full flex flex-col">
      <h2 className="flex-shrink-0">SIGNAL PIPELINE</h2>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="pipeline flex-1 min-h-0">
          {STAGES.map((stage, i) => (
            <div key={stage.key} className="pipeline-stage">
              <div className="pipeline-stage-name">{stage.label}</div>
              <div className="pipeline-stage-count mono">{counts[i]}</div>
              <div className="text-[10px] text-muted">{stage.sub}</div>
            </div>
          ))}
          {STAGES.slice(0, -1).map((_, i) => (
            <div key={`arrow-${i}`} className="pipeline-arrow">
              →
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="text-label mb-2">QUEUED SIGNALS</div>
          <div className="scroll max-h-[200px]">
            {signals.length === 0 ? (
              <div className="text-muted p-2 text-[10px]">NO SIGNALS</div>
            ) : (
              signals.map((s) => (
                <div key={s.symbol} className="log-entry py-1">
                  <span className="log-time">{s.direction.toUpperCase()}</span>
                  <span className="log-agent">{s.symbol}</span>
                  <span className="log-msg">{s.setup_type}</span>
                  <span className="log-json ml-2">{s.confidence}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SignalQueueProps {
  signals: Signal[]
}
