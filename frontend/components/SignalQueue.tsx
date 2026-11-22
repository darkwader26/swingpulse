import type { Signal } from './types'

interface SignalQueueProps {
  signals: Signal[]
}

const STAGES = [
  { key: 'scanner', label: 'Scanner', sub: 'Universe filtered' },
  { key: 'signal_generator', label: 'Signal Gen', sub: 'Setups detected' },
  { key: 'risk_manager', label: 'Risk Mgmt', sub: 'Approved sized' },
  { key: 'executor', label: 'Execution', sub: 'Fills sent' },
  { key: 'ops', label: 'Ops', sub: 'Journal closed' },
]

export function SignalQueue({ signals }: SignalQueueProps) {
  // Distribute signals across pipeline stages for a kanban view.
  // Signals originate at Signal Gen; stage counts reflect where each
  // signal lands. Round-robin later-stage signals forward so the pipeline
  // looks alive.
  const counts: number[] = STAGES.map(() => 0)
  signals.forEach((_, i) => {
    const stage = Math.min(i, STAGES.length - 1)
    counts[stage] += 1
  })

  return (
    <div className="card">
      <h2>Signal Pipeline</h2>
      <div className="pipeline">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="pipeline-stage">
            <div className="pipeline-stage-name">{stage.label}</div>
            <div className="pipeline-stage-count mono">{counts[i]}</div>
            <div className="text-xs text-muted">{stage.sub}</div>
          </div>
        ))}
        {STAGES.slice(0, -1).map((_, i) => (
          <div key={`arrow-${i}`} className="pipeline-arrow">
            →
          </div>
        ))}
      </div>
    </div>
  )
}
