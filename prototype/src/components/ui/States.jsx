import { useApp } from "../../state/AppState.jsx";
import Icon from "./Icon.jsx";

export function Skeleton({ height = 280, label }) {
  const { t } = useApp();
  return (
    <div className="state state--loading" style={{ minHeight: height }} role="status" aria-live="polite">
      <div className="skeleton-lines" aria-hidden="true">
        <span style={{ width: "38%" }} />
        <span style={{ width: "62%" }} />
        <span className="skeleton-chart" />
      </div>
      <span className="sr-only">{label ?? t("state.loading")}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry, height = 220 }) {
  const { t } = useApp();
  return (
    <div className="state state--error" style={{ minHeight: height }} role="alert">
      <Icon name="info" size={22} />
      <p className="state-title">{t("state.errorTitle")}</p>
      <p className="state-text">{t("state.errorText")}</p>
      {message && <p className="state-detail t-meta">{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          {t("state.retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, text, height = 200 }) {
  const { t } = useApp();
  return (
    <div className="state state--empty" style={{ minHeight: height }}>
      <Icon name="table" size={22} />
      <p className="state-title">{title ?? t("state.emptyTitle")}</p>
      <p className="state-text">{text ?? t("state.emptyText")}</p>
    </div>
  );
}

export function UnavailableState({ title, text, height = 200 }) {
  return (
    <div className="state state--unavailable" style={{ minHeight: height }}>
      <Icon name="layers" size={22} />
      <p className="state-title">{title}</p>
      <p className="state-text">{text}</p>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container" style={{ paddingBlock: "120px" }}>
      <Skeleton height={420} />
    </div>
  );
}

// Renders children when data is ready, a skeleton while loading, and an
// error state on failure — the same three states everywhere.
export function Async({ state, height, children }) {
  if (state.error && !state.data) return <ErrorState message={state.error} height={height} onRetry={() => window.location.reload()} />;
  if (!state.data) return <Skeleton height={height} />;
  return children(state.data);
}
