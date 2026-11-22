import { useState } from 'react'

export function KillSwitch({ initial = false }: { initial?: boolean } = {}) {
  const [active, setActive] = useState(initial)

  return (
    <button
      onClick={() => setActive((a) => !a)}
      className={`killswitch ${active ? 'active' : ''}`}
      aria-pressed={active}
      aria-label={active ? 'System halted — click to resume' : 'Kill switch — halt all new entries'}
    >
      <span className="killswitch-label">
        {active ? '✓ System Halted' : '⚠ Kill Switch'}
      </span>
    </button>
  )
}
