import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";

const COLORS = ["#2b6ca3", "#d98e2b", "#5b6b7a", "#0f3a57", "#9c3b26", "#4d7894"];

export default function ChartPanel({ data, seriesNames, chartType, onChartTypeChange }) {
  if (!data.length) return <div className="panel-status">Graafiku jaoks andmed puuduvad.</div>;

  const Chart = chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="chart-panel" id="chart-panel-root">
      <div className="chart-toggle">
        <button
          className={chartType === "line" ? "active" : ""}
          onClick={() => onChartTypeChange("line")}
        >
          Joon
        </button>
        <button
          className={chartType === "bar" ? "active" : ""}
          onClick={() => onChartTypeChange("bar")}
        >
          Tulp
        </button>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          {seriesNames.map((name, i) =>
            chartType === "bar" ? (
              <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} isAnimationActive={false} />
            ) : (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
                isAnimationActive={false}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
