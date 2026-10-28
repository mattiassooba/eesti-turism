import { HERO_OUTLINE, HERO_VIEWBOX } from "../../geo/generated.js";

// Dark band at the top of every dedicated page, with the real coastline
// drawn as a quiet line, then a sticky row of in-page section links.
export default function PageHeader({ kicker, title, lead, aside, tabs, children }) {
  const [w, h] = HERO_VIEWBOX;
  return (
    <>
      <header className="page-head" data-theme="dark">
        <div className="page-head-backdrop" aria-hidden="true">
          <svg className="page-head-art" viewBox={`0 0 ${w} ${h}`}>
            <path d={HERO_OUTLINE} />
          </svg>
        </div>
        <div className="container">
          <div className="page-head-grid">
            <div>
              {kicker && (
                <p className="kicker">
                  <span className="kicker-rule" aria-hidden="true" />
                  {kicker}
                </p>
              )}
              <h1 className="page-head-title">{title}</h1>
              {lead && <p className="page-head-lead">{lead}</p>}
            </div>
            {aside && <div className="page-head-aside">{aside}</div>}
          </div>
          {children}
        </div>
      </header>
      {tabs?.length > 0 && (
        <nav className="page-tabs" aria-label={tabs.label ?? undefined}>
          <div className="container">
            <ul>
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <a href={`#${tab.id}`}>{tab.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </>
  );
}
