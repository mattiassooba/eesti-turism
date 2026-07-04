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

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export default function ChartPanel({ data, seriesNames, chartType, onChartTypeChange }) {
  if (!data.length) return <div className="panel-status">No data to chart.</div>;

  const Chart = chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="chart-panel" id="chart-panel-root">
      <div className="chart-toggle">
        <button
          className={chartType === "line" ? "active" : ""}
          onClick={() => onChartTypeChange("line")}
        >
          Line
        </button>
        <button
          className={chartType === "bar" ? "active" : ""}
          onClick={() => onChartTypeChange("bar")}
        >
          Bar
        </button>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Legend />
          {seriesNames.map((name, i) =>
            chartType === "bar" ? (
              <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} />
            ) : (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
