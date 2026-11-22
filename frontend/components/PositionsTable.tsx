import type { Position } from './types'
import { EmptyState } from './EmptyState'

interface PositionsTableProps {
  positions: Position[]
}

const badgeClass = (side: string) => {
  if (side === 'long') return 'badge badge-approved'
  if (side === 'short') return 'badge badge-pending'
  return 'badge badge-rejected'
}

const pnlColor = (v: number) => {
  if (v > 0) return 'pos-long'
  if (v < 0) return 'pos-short'
  return 'pos-flat'
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="card h-full flex flex-col">
      <h2 className="flex-shrink-0">OPEN POSITIONS</h2>
      <div className="flex-1 scroll min-h-0">
        <table>
          <thead>
            <tr>
              <th style={{ width: '70px' }}>SYMBOL</th>
              <th style={{ width: '70px' }}>SIDE</th>
              <th style={{ width: '100px' }}>ENTRY</th>
              <th style={{ width: '100px' }}>STOP</th>
              <th style={{ width: '100px' }}>TARGET</th>
              <th style={{ width: '80px' }}>QTY</th>
              <th style={{ width: '110px' }}>UNREALIZED P&L</th>
              <th style={{ width: '100px' }}>R-MULTIPLE</th>
              <th>AGE</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-muted py-4 text-center">
                  <EmptyState title="NO OPEN POSITIONS" subtitle="No swings currently open" icon="▱" />
                </td>
              </tr>
            ) : (
              positions.map((p) => (
                <tr key={p.symbol}>
                  <td className="mono">{p.symbol}</td>
                  <td><span className={badgeClass(p.side)}>{p.side.toUpperCase()}</span></td>
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
