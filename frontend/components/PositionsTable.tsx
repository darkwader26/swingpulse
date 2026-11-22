import type { Position } from './types'
import { EmptyState } from './EmptyState'

interface PositionsTableProps {
  positions: Position[]
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const pnlColor = (v: number) => {
    if (v > 0) return 'pos-long'
    if (v < 0) return 'pos-short'
    return 'pos-flat'
  }

  const sideColor = (side: string) => {
    if (side === 'long') return 'pos-long'
    if (side === 'short') return 'pos-short'
    return 'pos-flat'
  }

  return (
    <div className="card">
      <h2>Open Positions</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: '70px' }}>Symbol</th>
              <th style={{ width: '70px' }}>Side</th>
              <th style={{ width: '100px' }}>Entry</th>
              <th style={{ width: '100px' }}>Stop</th>
              <th style={{ width: '100px' }}>Target</th>
              <th style={{ width: '80px' }}>Qty</th>
              <th style={{ width: '110px' }}>Unrealized P&L</th>
              <th style={{ width: '100px' }}>R-Multiple</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-muted text-center py-4">
                  <EmptyState title="No open positions" subtitle="No swings currently open" />
                </td>
              </tr>
            ) : (
              positions.map((p) => (
                <tr key={p.symbol}>
                  <td className="mono">{p.symbol}</td>
                  <td>
                    <span className={`badge ${sideColor(p.side.toLowerCase())}`}>{p.side}</span>
                  </td>
                  <td className="mono">${p.entry.toFixed(2)}</td>
                  <td className="mono">${p.stop.toFixed(2)}</td>
                  <td className="mono">${p.target.toFixed(2)}</td>
                  <td className="mono">{p.qty.toLocaleString()}</td>
                  <td className={`mono ${pnlColor(p.unrealized_pnl)}`}>
                    {p.unrealized_pnl >= 0 ? '+' : ''}${p.unrealized_pnl.toFixed(2)}
                  </td>
                  <td className={`mono ${pnlColor(p.r_multiple)}`}>
                    {p.r_multiple >= 0 ? '+' : ''}${p.r_multiple.toFixed(2)} R
                  </td>
                  <td className="text-muted">{p.age}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
