import { useState } from 'react'

export function KillSwitch({ initial = false }: { initial?: boolean } = {}) {
  const [active, setActive] = useState(initial)

  return (
    <div className="card h-full flex flex-col">
      <h2 className="flex-shrink-0">KILL SWITCH</h2>
      <button
        onClick={() => setActive((a) => !a)}
        className={`killswitch ${active ? 'active' : ''} mt-2`}
        aria-pressed={active}
        aria-label={active ? 'System halted — click to resume' : 'Kill switch — halt all new entries'}
      >
        <span className="killswitch-light {active ? 'active' : ''}" aria-hidden="true" />
        <span className="killswitch-label">
          {active ? '✓ SYSTEM HALTED' : '⚠ KILL SWITCH'}
        </span>
      </button>
      <div className="mt-2 text-[10px] text-muted">
        {active ? 'ALL NEW ENTRIES HALTED' : 'SYSTEM ARMED'}
      </div>
    </div>
  )
}
