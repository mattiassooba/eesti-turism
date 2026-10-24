import { useApp } from "../../state/AppState.jsx";

function Table({ caption, cols, rows, render }) {
  return (
    <div className="data-table-wrap studio-table">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(render)}</tbody>
      </table>
    </div>
  );
}

export function FunctionStatus() {
  const { t } = useApp();
  const rows = t("studio.status.rows");
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.k]: (acc[r.k] ?? 0) + 1 }), {});
  return (
    <>
      <ul className="status-summary">
        {["real", "partial", "simulated", "excluded"].map((k) => (
          <li key={k}>
            <span className={`status-pill status-pill--${k}`}>{t(`studio.status.kinds.${k}`)}</span>
            <span className="status-count num">{counts[k] ?? 0}</span>
          </li>
        ))}
      </ul>
      <Table
        caption={t("studio.status.head")}
        cols={[t("studio.status.cols.feature"), t("studio.status.cols.status"), t("studio.status.cols.note")]}
        rows={rows}
        render={(r) => (
          <tr key={r.f}>
            <th scope="row">{r.f}</th>
            <td>
              <span className={`status-pill status-pill--${r.k}`}>{t(`studio.status.kinds.${r.k}`)}</span>
            </td>
            <td className="studio-note">{r.n}</td>
          </tr>
        )}
      />
    </>
  );
}

export function Checklist() {
  const { t } = useApp();
  return (
    <Table
      caption={t("studio.checklist.head")}
      cols={[t("studio.checklist.cols.feature"), t("studio.checklist.cols.where"), t("studio.checklist.cols.state")]}
      rows={t("studio.checklist.rows")}
      render={(r) => (
        <tr key={r.f}>
          <th scope="row">{r.f}</th>
          <td className="studio-note">{r.w}</td>
          <td>
            <span className={`status-pill status-pill--${r.s}`}>{t(`studio.checklist.states.${r.s}`)}</span>
          </td>
        </tr>
      )}
    />
  );
}

export function Redirects() {
  const { t } = useApp();
  return (
    <>
      <Table
        caption={t("studio.redirects.head")}
        cols={[t("studio.redirects.cols.from"), t("studio.redirects.cols.to"), t("studio.redirects.cols.how")]}
        rows={t("studio.redirects.rows")}
        render={(r) => (
          <tr key={r.from}>
            <th scope="row" className="studio-code">
              {r.from}
            </th>
            <td className="studio-code">{r.to}</td>
            <td className="studio-note">{r.how}</td>
          </tr>
        )}
      />
      <p className="studio-foot t-meta">{t("studio.redirects.note")}</p>
    </>
  );
}

export function Preview() {
  const { t } = useApp();
  const p = (k) => t(`studio.preview.${k}`);
  return (
    <div className="preview-grid">
      <div className="preview-card">
        <p className="block-label">{p("branch")}</p>
        <pre className="code">prototype/redesign</pre>
        <p className="t-meta">{p("branchNote")}</p>
      </div>
      <div className="preview-card">
        <p className="block-label">{p("run")}</p>
        <pre className="code">{"git checkout prototype/redesign\nnpm install\nnpm run proto"}</pre>
      </div>
      <div className="preview-card">
        <p className="block-label">{p("open")}</p>
        <pre className="code">http://localhost:5180</pre>
        <p className="t-meta">/stuudio · /en/studio</p>
      </div>
      <div className="preview-card">
        <p className="block-label">{p("files")}</p>
        <p className="studio-note">{p("filesNote")}</p>
      </div>
      <div className="preview-card preview-card--accent" data-theme="dark">
        <p className="block-label">{p("approval")}</p>
        <p>{p("approvalText")}</p>
      </div>
    </div>
  );
}
