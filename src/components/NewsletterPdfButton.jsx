import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { useRegion } from "../context/RegionContext.jsx";
import { countyLabelByCode } from "../data/counties";
import { loadNarrative } from "../data/narrative";

const SECTION_ORDER = ["dashboard", "map", "purpose", "capacity", "expenses"];
const SECTION_NAV_KEY = {
  dashboard: "nav.dashboard",
  map: "nav.map",
  purpose: "nav.purpose",
  capacity: "nav.capacity",
  expenses: "nav.expenses",
};

const MARGIN = 48;
const LINE_HEIGHT = 14;

// Only enabled once narrative.json is confirmed present — same
// graceful-degradation stance as NarrativeBlock (no error UI, just no
// button, before the first scheduled generation has ever run).
export default function NewsletterPdfButton() {
  const { t, locale } = useTranslation();
  const { region } = useRegion();
  const [narrative, setNarrative] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadNarrative().then((data) => {
      if (!cancelled && data?.sections) setNarrative(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!narrative) return null;

  async function download() {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - MARGIN * 2;
      let y = MARGIN;

      function ensureSpace(needed) {
        if (y + needed > pageHeight - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
      }

      function paragraph(text, { font = "normal", size = 10.5, gap = 10, color = 0 } = {}) {
        doc.setFont("helvetica", font);
        doc.setFontSize(size);
        doc.setTextColor(color);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT);
          doc.text(line, MARGIN, y);
          y += LINE_HEIGHT;
        }
        doc.setTextColor(0);
        y += gap;
      }

      const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;
      const regionLabel = countyLabelByCode(region, locale);

      paragraph(`${t("app.brand")} — ${periodLabel}`, { font: "bold", size: 20, gap: 4 });
      paragraph(t("newsletterPdf.intro"), { font: "italic", size: 9, color: 110, gap: 18 });

      for (const key of SECTION_ORDER) {
        // The dashboard blurb has a per-region variant, keyed by the same
        // region code as the Ülevaade tab's selector — same fallback rule
        // as NarrativeBlock: use it when available, else the national text.
        const regionBlurb = key === "dashboard" ? narrative.sections.dashboardByRegion?.[region] : null;
        const section = regionBlurb ?? narrative.sections[key];
        if (!section) continue;
        ensureSpace(LINE_HEIGHT * 2);
        const heading = key === "dashboard" ? `${t(SECTION_NAV_KEY[key])} — ${regionLabel}` : t(SECTION_NAV_KEY[key]);
        paragraph(heading, { font: "bold", size: 13, gap: 6 });
        paragraph(section[locale] ?? section.et, { gap: 16 });
      }

      await addOperatorSnapshot(doc, { pageHeight, maxWidth, marginY: MARGIN, t, regionLabel });

      const generatedDate = new Date(narrative.generatedAt).toLocaleDateString(
        locale === "en" ? "en-US" : "et-EE"
      );
      ensureSpace(LINE_HEIGHT);
      paragraph(`${t("newsletterPdf.generatedOn")} ${generatedDate} · turismistatistika.ee`, {
        font: "italic",
        size: 8.5,
        color: 110,
        gap: 0,
      });

      doc.save(`eesti-turism-${narrative.period}-${locale}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button type="button" className="newsletter-pdf-button" onClick={download} disabled={generating}>
      {generating ? t("newsletterPdf.generating") : t("newsletterPdf.download")}
    </button>
  );
}

// Captures the Ülevaade tab's operator charts + yearly table as a live
// snapshot (same technique as ExportButtons' PNG export: rasterize what's
// actually on screen) and adds it as its own page. Best-effort: the node
// only exists once the scroll view has been rendered at least once this
// session, so a missing node (or a capture failure) just skips this page
// rather than failing the whole download.
async function addOperatorSnapshot(doc, { pageHeight, maxWidth, marginY, t, regionLabel }) {
  const node = document.getElementById("operator-yearly-card");
  if (!node) return;

  let canvas;
  try {
    const html2canvas = (await import("html2canvas")).default;
    canvas = await html2canvas(node, { scale: 1.5, backgroundColor: "#ffffff" });
  } catch (err) {
    console.warn("Newsletter PDF: skipping charts/table snapshot —", err);
    return;
  }

  doc.addPage();
  let y = marginY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${t("newsletterPdf.chartsHeading")} — ${regionLabel}`, marginY, y);
  y += 20;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  const captionLines = doc.splitTextToSize(t("newsletterPdf.chartsCaption", regionLabel), maxWidth);
  for (const line of captionLines) {
    doc.text(line, marginY, y);
    y += 11;
  }
  doc.setTextColor(0);
  y += 8;

  let drawWidth = maxWidth;
  let drawHeight = (canvas.height / canvas.width) * drawWidth;
  const maxImgHeight = pageHeight - y - marginY;
  if (drawHeight > maxImgHeight) {
    drawHeight = maxImgHeight;
    drawWidth = (canvas.width / canvas.height) * drawHeight;
  }
  const x = marginY + (maxWidth - drawWidth) / 2;
  // JPEG at less-than-max quality — this is a chart/table screenshot, not a
  // photo, but a lossless PNG at this resolution ran to 10+ MB, far too
  // heavy for a "download the newsletter" button.
  doc.addImage(canvas.toDataURL("image/jpeg", 0.82), "JPEG", x, y, drawWidth, drawHeight);
}
