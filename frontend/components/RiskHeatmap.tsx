import type { Risk } from './types'

function exposureColor(value: number) {
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
    <div className="card h-full flex flex-col">
      <h2 className="flex-shrink-0">RISK HEATMAP</h2>
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Correlation matrix */}
        <div className="card p-4 min-h-0 flex flex-col">
          <div className="text-label mb-3">SECTOR CORRELATION</div>
          <div className="flex-1 flex flex-col min-h-0">
            {exposure.map((e) => (
              <div key={e.sector} className="flex items-center gap-2 mb-3">
                <div
                  className="h-8 w-8 border border-border flex items-center justify-center text-[10px] mono"
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

        {/* Sector exposure bars */}
        <div className="card p-4 min-h-0 flex flex-col">
          <div className="text-label mb-3">SECTOR EXPOSURE</div>
          <div className="flex-1 min-h-0">
            {exposure.map((e) => (
              <div key={e.sector} className="flex items-center gap-3 mb-3">
                <span className="text-[11px] text-muted w-24">{e.sector}</span>
                <div
                  className="h-5 border border-border flex overflow-hidden"
                  style={{ width: '100%', backgroundColor: '#242424' }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(e.value, 100)}%`,
                      backgroundColor: exposureColor(e.value),
                    }}
                  />
                </div>
                <span className="mono text-[11px] w-16 text-right">{e.value.toFixed(0)}%</span>
              </div>
            ))}
            <div className="mt-4 pt-2 border-t border-border">
              <div className="flex justify-between text-[10px] text-muted mb-1">
                <span>DAILY LOSS LEFT</span>
                <span className="mono">${dailyLossLeft.toFixed(2)}%</span>
              </div>
              <div className="w-full h-2 border border-border overflow-hidden" style={{ backgroundColor: '#242424' }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min((dailyLossLeft / Math.max(risk.daily_loss_limit, 0.01)) * 100, 100)}%`,
                    backgroundColor: risk.kill_switch ? '#ff3333' : '#00ff41',
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

interface RiskHeatmapProps {
  risk: Risk
}
