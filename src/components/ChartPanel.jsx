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
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { CHART_COLORS as COLORS, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

export default function ChartPanel({ data, seriesNames, chartType, onChartTypeChange }) {
  const { t, locale } = useTranslation();
  if (!data.length) return <div className="panel-status">{t("chartPanel.noData")}</div>;

  const Chart = chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="chart-panel" id="chart-panel-root">
      <div className="chart-toggle">
        <button
          className={chartType === "line" ? "active" : ""}
          onClick={() => onChartTypeChange("line")}
        >
          {t("chartPanel.line")}
        </button>
        <button
          className={chartType === "bar" ? "active" : ""}
          onClick={() => onChartTypeChange("bar")}
        >
          {t("chartPanel.bar")}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis
            dataKey="x"
            tick={{ fill: CHART_AXIS_COLOR }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={{ stroke: CHART_GRID_COLOR }}
          />
          <YAxis
            tick={{ fill: CHART_AXIS_COLOR }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={{ stroke: CHART_GRID_COLOR }}
          />
          <Tooltip content={<ChartTooltip locale={locale} />} />
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
