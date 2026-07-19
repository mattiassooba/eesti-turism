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

      // Fits the canvas to maxWidth, paginating first if it wouldn't fit on
      // the remaining space of the current page.
      function image(canvas, { maxHeight = 260, gap = 16 } = {}) {
        let drawWidth = maxWidth;
        let drawHeight = (canvas.height / canvas.width) * drawWidth;
        if (drawHeight > maxHeight) {
          drawHeight = maxHeight;
          drawWidth = (canvas.width / canvas.height) * drawHeight;
        }
        ensureSpace(drawHeight);
        const x = MARGIN + (maxWidth - drawWidth) / 2;
        // JPEG at less-than-max quality — this is a chart/table screenshot,
        // not a photo, but a lossless PNG at this resolution ran 10+ MB.
        doc.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", x, y, drawWidth, drawHeight);
        y += drawHeight + gap;
      }

      const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;
      const regionLabel = countyLabelByCode(region, locale);
      const { chartsCanvas, tableCanvas } = await captureOperatorSnapshots();

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

        // The operator charts belong to the same "Vali maakond" selector as
        // this region-specific blurb, so they're placed right underneath it
        // rather than tacked on as a separate page at the end of the doc.
        if (key === "dashboard" && chartsCanvas) {
          paragraph(t("newsletterPdf.chartsCaption", regionLabel), { font: "italic", size: 8.5, color: 110, gap: 6 });
          image(chartsCanvas, { maxHeight: 220 });
        }
      }

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

      // The yearly table stays its own appendix page (it's tall regardless
      // of width) rather than flowing inline like the compact charts image.
      if (tableCanvas) {
        doc.addPage();
        y = MARGIN;
        paragraph(t("newsletterPdf.tableHeading"), { font: "bold", size: 14, gap: 6 });
        paragraph(t("newsletterPdf.chartsCaption", regionLabel), { font: "italic", size: 8.5, color: 110, gap: 10 });
        image(tableCanvas, { maxHeight: pageHeight - y - MARGIN });
      }

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
// actually on screen). Best-effort: the node only exists once the scroll
// view has been rendered at least once this session, so a missing node (or
// a capture failure) just returns nulls rather than failing the download.
async function captureOperatorSnapshots() {
  const node = document.getElementById("operator-yearly-card");
  const chartsRow = node?.querySelector(".tile-row-split");
  const tableWrapper = node?.querySelector(".data-grid-wrapper");
  if (!chartsRow || !tableWrapper) return { chartsCanvas: null, tableCanvas: null };

  try {
    const html2canvas = (await import("html2canvas")).default;
    const chartsCanvas = await html2canvas(chartsRow, { scale: 1.5, backgroundColor: "#ffffff" });
    // The table wrapper scrolls horizontally on screen (many yearly
    // columns) — a plain capture only grabs the visible viewport and
    // silently drops whatever's scrolled out of view. Forcing the clone's
    // width to the wrapper's full scrollWidth (and disabling its overflow
    // clipping) makes html2canvas render — and capture — every column.
    const tableCanvas = await html2canvas(tableWrapper, {
      scale: 1.5,
      backgroundColor: "#ffffff",
      width: tableWrapper.scrollWidth,
      windowWidth: tableWrapper.scrollWidth,
      onclone: (_doc, el) => {
        el.style.overflow = "visible";
        el.style.width = `${tableWrapper.scrollWidth}px`;
      },
    });
    return { chartsCanvas, tableCanvas };
  } catch (err) {
    console.warn("Newsletter PDF: skipping charts/table snapshot —", err);
    return { chartsCanvas: null, tableCanvas: null };
  }
}
