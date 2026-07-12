import { formatNumber } from "../i18n/format";

export default function RankedBarList({ items, unit, locale = "et" }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="ranked-bar-list">
      {items.map((item) => (
        <div key={item.label} className="ranked-bar-row">
          <div className="ranked-bar-label">{item.label}</div>
          <div className="ranked-bar-track">
            <div className="ranked-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <div className="ranked-bar-value">
            {formatNumber(item.value, locale)}
            {unit ? <span className="ranked-bar-unit"> {unit}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
