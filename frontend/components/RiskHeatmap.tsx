import type { Risk } from './types'

interface RiskHeatmapProps {
  risk: Risk
}

// Categorical color slots per the data-viz method (dark mode steps, slot order fixed).
const SLOTS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']

function exposureColor(value: number) {
  // Sequential ramp: higher exposure -> darker. One hue (blue), light->dark.
  const t = Math.min(Math.max(value, 0), 100)
  const steps = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#104281']
  const idx = Math.min(Math.floor((t / 100) * (steps.length - 1)), steps.length - 1)
  return steps[idx]
}

export function RiskHeatmap({ risk }: RiskHeatmapProps) {
  const exposure = Object.entries(risk.sector_exposure).map(([sector, value]) => ({
    sector,
    value: typeof value === 'number' ? value : 0,
  }))

  const dailyLossLeft = Math.max(0, risk.daily_loss_limit - Math.abs(risk.daily_loss_percent))

  return (
    <div className="card">
      <h2>Risk Heatmap</h2>
      <div className="grid grid-cols-2 gap-4">
        {/* Correlation matrix (CSS grid) */}
        <div className="card p-4">
          <div className="text-label mb-3">Sector Correlation</div>
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="w-full max-w-xs">
              {exposure.map((e) => (
                <div key={e.sector} className="flex items-center gap-2 mb-2">
                  <div
                    className="h-8 w-8 rounded border border-border flex items-center justify-center text-[10px] mono"
                    style={{
                      backgroundColor: exposureColor(e.value),
                      color: e.value > 50 ? '#0b0b0b' : '#f2f2f2',
                    }}
                  >
                    {(e.value / 100).toFixed(2)}
                  </div>
                  <span className="text-[11px] text-muted">{e.sector}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sector exposure bars */}
        <div className="card p-4">
          <div className="text-label mb-3">Sector Exposure</div>
          <div style={{ height: 200 }}>
            {exposure.map((e) => (
              <div key={e.sector} className="flex items-center gap-3 mb-3">
                <span className="text-[11px] text-muted w-24">{e.sector}</span>
                <div
                  className="h-5 rounded bg-surface border border-border flex overflow-hidden"
                  style={{ width: '100%' }}
                >
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(e.value, 100)}%`, backgroundColor: exposureColor(e.value) }}
                  />
                </div>
                <span className="mono text-[11px] w-16 text-right">{e.value.toFixed(0)}%</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex justify-between text-[10px] text-muted mb-1">
                <span>Daily Loss Left</span>
                <span className="mono">${dailyLossLeft.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-surface h-2 rounded overflow-hidden border border-border">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min((dailyLossLeft / Math.max(risk.daily_loss_limit, 0.01)) * 100, 100)}%`,
                    backgroundColor: risk.kill_switch ? '#ef4444' : '#14b8a6',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
