import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface EquityCurveProps {
  data: Array<{ t: string; v: number }>
}

export function EquityCurve({ data }: EquityCurveProps) {
  return (
    <div className="card">
      <h2>Equity Curve</h2>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444444" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#999999' }} />
            <YAxis tick={{ fontSize: 10, fill: '#999999' }} />
            <Tooltip contentStyle={{ background: '#2a2a2a', border: '1px solid #444444' }} />
            <Line type="monotone" dataKey="v" stroke="#14b8a6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
