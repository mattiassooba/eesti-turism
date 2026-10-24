import { useApp } from "../state/AppState.jsx";
import PageHeader from "../components/layout/PageHeader.jsx";
import { Section, SectionHead } from "../components/ui/Primitives.jsx";
import BrandCompare from "./studio/BrandCompare.jsx";
import { Palette, Typography } from "./studio/Foundations.jsx";
import { Components, Responsive } from "./studio/Gallery.jsx";
import Walkthrough from "./studio/Walkthrough.jsx";
import { FunctionStatus, Checklist, Redirects, Preview } from "./studio/Status.jsx";

const SECTIONS = [
  { id: "brand", tab: "brand", head: "studio.brand.head", lead: "studio.brand.lead", Body: BrandCompare, tone: "paper" },
  { id: "labikaik", tab: "walkthrough", head: "studio.walk.head", lead: "studio.walk.lead", Body: Walkthrough, tone: "white" },
  { id: "varvid", tab: "palette", head: "studio.palette.head", lead: "studio.palette.lead", Body: Palette, tone: "paper" },
  { id: "tupograafia", tab: "type", head: "studio.type.head", lead: "studio.type.lead", Body: Typography, tone: "white" },
  { id: "komponendid", tab: "components", head: "studio.components.head", lead: "studio.components.lead", Body: Components, tone: "paper" },
  { id: "ekraanid", tab: "responsive", head: "studio.responsive.head", lead: "studio.responsive.lead", Body: Responsive, tone: "mist" },
  { id: "funktsioonid", tab: "status", head: "studio.status.head", lead: "studio.status.lead", Body: FunctionStatus, tone: "white" },
  { id: "kontroll", tab: "checklist", head: "studio.checklist.head", lead: "studio.checklist.lead", Body: Checklist, tone: "paper" },
  { id: "suunamised", tab: "redirects", head: "studio.redirects.head", lead: "studio.redirects.lead", Body: Redirects, tone: "white" },
  { id: "eelvaade", tab: "preview", head: "studio.preview.head", lead: "studio.preview.lead", Body: Preview, tone: "paper" },
];

export default function Studio() {
  const { t } = useApp();
  return (
    <div className="studio">
      <PageHeader
        kicker={t("studio.kicker")}
        title={t("studio.title")}
        lead={t("studio.lead")}
        tabs={SECTIONS.map((s) => ({ id: s.id, label: t(`studio.tabs.${s.tab}`) }))}
        aside={<p className="studio-notice">{t("studio.notice")}</p>}
      />
      {SECTIONS.map(({ id, tab, head, lead, Body, tone }) => (
        <Section key={id} id={id} tone={tone} labelledBy={`st-${id}`}>
          <SectionHead id={`st-${id}`} kicker={t(`studio.tabs.${tab}`)} title={t(head)} lead={t(lead)} />
          <Body />
        </Section>
      ))}
    </div>
  );
}
