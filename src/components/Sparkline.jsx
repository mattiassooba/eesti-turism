import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function Sparkline({ data, color = "#eef0ee", height = 40 }) {
  return (
    <div className="sparkline" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
