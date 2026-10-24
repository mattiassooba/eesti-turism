import { useRef, useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { PATHS } from "../data/client.js";
import { officialTableUrl } from "../components/ui/Primitives.jsx";
import PageHeader from "../components/layout/PageHeader.jsx";
import { Section, SectionHead } from "../components/ui/Primitives.jsx";
import Icon from "../components/ui/Icon.jsx";
import { LocaleProvider } from "@prod/i18n/LocaleContext.jsx";
import ProdSidebar from "@prod/components/Sidebar.jsx";
import ProdTableView from "@prod/components/TableView.jsx";

// file = the PxWeb file name exactly as the API expects it (case matters).
const CATALOGUE = [
  {
    group: "acc",
    tables: [
      { id: "TU131", file: "TU131.PX", folder: "majutus", level: "region", freq: "month" },
      { id: "TU133", file: "TU133.PX", folder: "majutus", level: "region", freq: "month" },
      { id: "TU122", file: "TU122.PX", folder: "majutus", level: "region", freq: "month" },
      { id: "TU121", file: "TU121.PX", folder: "majutus", level: "region", freq: "month" },
      { id: "TU11", file: "TU11.PX", folder: "majutus", level: "national", freq: "year" },
    ],
  },
  {
    group: "res",
    tables: [
      { id: "TU51", file: "TU51.PX", folder: "reisimine", level: "national", freq: "quarter" },
      { id: "TU54", file: "TU54.PX", folder: "reisimine", level: "national", freq: "quarter" },
      { id: "TU551", file: "TU551.PX", folder: "reisimine", level: "national", freq: "quarter" },
      { id: "TU56", file: "TU56.PX", folder: "reisimine", level: "national", freq: "quarter" },
      { id: "TU63", file: "TU63.PX", folder: "reisimine", level: "national", freq: "quarter" },
      { id: "TU661", file: "TU661.PX", folder: "reisimine", level: "national", freq: "quarter" },
      { id: "TU552", file: "TU552.px", folder: "reisimine", level: "national", freq: "year" },
    ],
  },
  {
    group: "eco",
    tables: [
      { id: "TU410", file: "TU410.PX", folder: "turismMajandus", level: "national", freq: "quarter" },
      { id: "EM001", file: "EM001.PX", folder: "em001", level: "national", freq: "year" },
      { id: "PA113", file: "PA113.px", folder: "pa113", level: "national", freq: "quarter" },
    ],
  },
];

function Catalogue({ onOpen, selected }) {
  const { t, locale } = useApp();
  return (
    <div className="catalogue">
      {CATALOGUE.map((g) => (
        <div key={g.group} className="catalogue-group">
          <h3 className="t-label">{t(`dataPage.group.${g.group}`)}</h3>
          <ul className="catalogue-list">
            {g.tables.map((tb) => (
              <li key={tb.id} className={"catalogue-item" + (selected === tb.file ? " is-active" : "")}>
                <button type="button" className="catalogue-open" onClick={() => onOpen(tb)}>
                  <span className="catalogue-id num">{tb.id}</span>
                  <span className="catalogue-title">{t(`dataPage.t.${tb.id}`)}</span>
                  <span className="catalogue-meta">
                    <span className={"tag" + (tb.level === "national" ? " tag--national" : "")}>{t(`dataPage.level.${tb.level}`)}</span>
                    <span className="tag">{t(`dataPage.freq.${tb.freq}`)}</span>
                  </span>
                </button>
                <a className="catalogue-ext" href={officialTableUrl(tb.id, locale)} target="_blank" rel="noreferrer" aria-label={t("dataPage.official", tb.id)}>
                  <Icon name="external" size={15} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function DataTables() {
  const { t } = useApp();
  const [selected, setSelected] = useState(null);
  const explorerRef = useRef(null);
  const open = (path, tableId, title) => {
    setSelected({ path, tableId, title });
    requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const openCatalogue = (tb) => open(PATHS[tb.folder], tb.file, `${tb.id} · ${t(`dataPage.t.${tb.id}`)}`);
  const tabs = [
    { id: "kataloog", label: t("dataPage.tabCatalogue") },
    { id: "uurija", label: t("dataPage.tabExplorer") },
  ];
  return (
    <>
      <PageHeader kicker={t("nav.data")} title={t("dataPage.title")} lead={t("dataPage.lead")} tabs={tabs} />
      <Section id="kataloog" tone="paper" labelledBy="d-cat">
        <SectionHead id="d-cat" kicker={t("dataPage.tabCatalogue")} title={t("dataPage.catTitle")} lead={t("dataPage.catLead")} />
        <Catalogue onOpen={openCatalogue} selected={selected?.tableId} />
      </Section>
      <Section id="uurija" tone="white" labelledBy="d-exp">
        <div ref={explorerRef} />
        <SectionHead id="d-exp" kicker={t("dataPage.tabExplorer")} title={t("dataPage.expTitle")} lead={t("dataPage.expLead")} />
        <LocaleProvider>
          <div className="prod-embed explorer">
            <aside className="explorer-side" aria-label={t("dataPage.treeLabel")}>
              <ProdSidebar onSelectTable={open} selectedTableId={selected?.tableId} />
            </aside>
            <div className="explorer-main">
              {selected ? (
                <ProdTableView key={selected.tableId} path={selected.path} tableId={selected.tableId} title={selected.title} />
              ) : (
                <div className="explorer-empty">
                  <Icon name="table" size={28} />
                  <p>{t("dataPage.empty")}</p>
                </div>
              )}
            </div>
          </div>
        </LocaleProvider>
        <p className="t-meta block-note">{t("dataPage.exportNote")}</p>
      </Section>
    </>
  );
}
