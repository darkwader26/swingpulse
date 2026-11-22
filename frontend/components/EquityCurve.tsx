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
    <div className="flex-1 min-h-0 relative w-full">
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        <div className="flex-1 w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <defs>
                <linearGradient id="equity-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff41" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00ff41" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#333333" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#888888' }} />
              <YAxis tick={{ fontSize: 10, fill: '#888888' }} />
              <Tooltip
                contentStyle={{
                  background: '#242424',
                  border: '2px solid #00ff41',
                  color: '#e0e0e0',
                  fontFamily: 'Courier New, monospace',
                  fontSize: 11,
                  padding: 6,
                }}
              />
              <Line type="monotone" dataKey="v" stroke="#00ff41" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-between px-1">
          <span className="text-[10px] text-muted mono">{data[0]?.t}</span>
          <span className="text-[10px] text-muted mono">{data[data.length - 1]?.t}</span>
        </div>
      </div>
    </div>
  )
}
