import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { useRegion } from "../context/RegionContext.jsx";
import { countyLabelByCode } from "../data/counties";
import { loadNarrative } from "../data/narrative";

const HIGHLIGHT_SECTIONS = ["map", "purpose", "capacity", "expenses"];
const SECTION_NAV_KEY = {
  map: "nav.map",
  purpose: "nav.purpose",
  capacity: "nav.capacity",
  expenses: "nav.expenses",
};

const MARGIN = 48;
const LINE_HEIGHT = 14;
// Match DOMESTIC_COLOR / FOREIGN_COLOR from src/theme.js, used everywhere
// else in the app for this exact residents-vs-foreign-visitors split.
const DOMESTIC_BAR_COLOR = [91, 107, 122];
const FOREIGN_BAR_COLOR = [217, 142, 43];

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
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
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

      // Bold "label: " followed by normal-weight text, wrapping subsequent
      // lines back to the margin — used for the page-1 highlight lines.
      function labeledLine(label, text) {
        ensureSpace(LINE_HEIGHT * 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const labelText = `${label}: `;
        doc.text(labelText, MARGIN, y);
        const labelWidth = doc.getTextWidth(labelText);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(text, maxWidth - labelWidth);
        doc.text(lines[0] ?? "", MARGIN + labelWidth, y);
        y += LINE_HEIGHT;
        for (let i = 1; i < lines.length; i++) {
          ensureSpace(LINE_HEIGHT);
          doc.text(lines[i], MARGIN, y);
          y += LINE_HEIGHT;
        }
        y += 8;
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

      // Drawn with jsPDF's own vector primitives, not a DOM screenshot — the
      // only fully-national charts in the app live on the lazy-mounted Map
      // tab, so a live capture would frequently just be missing. This has
      // no DOM dependency at all and works regardless of which tab is open.
      // Stacked bars: domestic (bottom) + foreign (top) per year, same
      // residents-vs-visitors split and colors used everywhere else in the
      // app (see DOMESTIC_COLOR/FOREIGN_COLOR in src/theme.js).
      function nationalResidencyChart(series, { height = 140, gap = 16 } = {}) {
        if (!Array.isArray(series) || !series.length) return;
        ensureSpace(height + 34);
        const top = y;
        const max = Math.max(...series.map((d) => d.domestic + d.foreign), 1);
        const barGap = 6;
        const barWidth = (maxWidth - barGap * (series.length - 1)) / series.length;
        const axisY = top + height;

        doc.setDrawColor(210);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, axisY, MARGIN + maxWidth, axisY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        series.forEach((d, i) => {
          const domesticHeight = (d.domestic / max) * (height - 4);
          const foreignHeight = (d.foreign / max) * (height - 4);
          const barX = MARGIN + i * (barWidth + barGap);
          doc.setFillColor(...DOMESTIC_BAR_COLOR);
          doc.rect(barX, axisY - domesticHeight, barWidth, domesticHeight, "F");
          doc.setFillColor(...FOREIGN_BAR_COLOR);
          doc.rect(barX, axisY - domesticHeight - foreignHeight, barWidth, foreignHeight, "F");
          doc.setTextColor(110);
          doc.text(String(d.year), barX + barWidth / 2, axisY + 10, { align: "center" });
        });
        doc.setTextColor(0);

        const legendY = axisY + 26;
        doc.setFillColor(...DOMESTIC_BAR_COLOR);
        doc.rect(MARGIN, legendY - 7, 8, 8, "F");
        doc.setFontSize(8.5);
        doc.text(t("common.domestic"), MARGIN + 12, legendY);
        const legendGap = MARGIN + 12 + doc.getTextWidth(t("common.domestic")) + 16;
        doc.setFillColor(...FOREIGN_BAR_COLOR);
        doc.rect(legendGap, legendY - 7, 8, 8, "F");
        doc.text(t("common.foreign"), legendGap + 12, legendY);

        y = legendY + gap;
      }

      const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;
      const regionLabel = countyLabelByCode(region, locale);
      const dashboard = narrative.sections.dashboard;
      const regionBlurb = narrative.sections.dashboardByRegion?.[region];
      const { chartsCanvas, nationalTableCanvas, regionTableCanvas } = await captureOperatorSnapshots();

      // ---- Page 1: Estonia in general ---------------------------------
      paragraph(`${t("app.brand")} — ${periodLabel}`, { font: "bold", size: 20, gap: 4 });
      paragraph(t("newsletterPdf.intro"), { font: "italic", size: 9, color: 110, gap: 18 });

      paragraph(t("newsletterPdf.estoniaHeading"), { font: "bold", size: 14, gap: 8 });
      if (dashboard) paragraph(dashboard[locale] ?? dashboard.et, { gap: 16 });

      paragraph(t("newsletterPdf.nationalChartTitle"), { font: "bold", size: 11, gap: 6 });
      nationalResidencyChart(dashboard?.nationalYearlyResidency);

      paragraph(t("newsletterPdf.otherHighlights"), { font: "bold", size: 13, gap: 8 });
      for (const key of HIGHLIGHT_SECTIONS) {
        const section = narrative.sections[key];
        const highlight = section?.[locale === "en" ? "highlightEn" : "highlightEt"];
        if (highlight) labeledLine(t(SECTION_NAV_KEY[key]), highlight);
      }

      if (nationalTableCanvas) image(nationalTableCanvas, { maxHeight: 200 });

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

      // ---- Page 2: the selected region in detail ------------------------
      doc.addPage();
      y = MARGIN;

      paragraph(regionLabel, { font: "bold", size: 18, gap: 4 });
      paragraph(t("newsletterPdf.regionSubheading"), { font: "normal", size: 11, color: 110, gap: 10 });
      paragraph(t("newsletterPdf.chartsCaption", regionLabel), { font: "italic", size: 8.5, color: 110, gap: 14 });

      if (regionBlurb) paragraph(regionBlurb[locale] ?? regionBlurb.et, { gap: 16 });

      if (chartsCanvas) image(chartsCanvas, { maxHeight: 200 });
      if (regionTableCanvas) image(regionTableCanvas, { maxHeight: 220 });

      ensureSpace(LINE_HEIGHT);
      paragraph(`${t("source.prefix")} ${t("source.agency")}, ${t("source.tables")} TU131.PX, TU122.PX`, {
        font: "italic",
        size: 8,
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

// Captures the Ülevaade tab's operator charts and its two yearly tables
// (Estonia-only and region-specific) as live snapshots (same technique as
// ExportButtons' PNG export: rasterize what's actually on screen).
// Best-effort: these nodes only exist once the scroll view has rendered at
// least once this session (OperatorInsights lives inside the non-lazy
// Dashboard, so in practice that's true whenever the site is open at all),
// so a missing node just returns null for that entry rather than failing
// the whole download.
async function captureOperatorSnapshots() {
  const chartsRow = document.querySelector("#operator-yearly-card .tile-row-split");
  const nationalTable = document.querySelector("#operator-yearly-national .data-grid-wrapper");
  const regionTable = document.querySelector("#operator-yearly-card .data-grid-wrapper");

  if (!chartsRow && !nationalTable && !regionTable) {
    return { chartsCanvas: null, nationalTableCanvas: null, regionTableCanvas: null };
  }

  try {
    const html2canvas = (await import("html2canvas")).default;
    const capture = (node) => (node ? html2canvas(node, { scale: 1.5, backgroundColor: "#ffffff" }) : null);
    // Both yearly tables scroll horizontally on screen (many year columns)
    // — a plain capture only grabs the visible viewport and silently drops
    // whatever's scrolled out of view. Forcing the clone's width to the
    // wrapper's full scrollWidth (and disabling its overflow clipping)
    // makes html2canvas render — and capture — every column.
    const captureFullWidthTable = (node, { onclone } = {}) =>
      node
        ? html2canvas(node, {
            scale: 1.5,
            backgroundColor: "#ffffff",
            width: node.scrollWidth,
            windowWidth: node.scrollWidth,
            onclone: (_doc, el) => {
              el.style.overflow = "visible";
              el.style.width = `${node.scrollWidth}px`;
              onclone?.(el);
            },
          })
        : null;

    const [chartsCanvas, nationalTableCanvas, regionTableCanvas] = await Promise.all([
      capture(chartsRow),
      captureFullWidthTable(nationalTable),
      // The region table's own "top origin country" rows show 5 ranks
      // on-screen (one row per rank) — trimmed to the top 3 for the PDF.
      captureFullWidthTable(regionTable, {
        onclone: (el) => {
          el.querySelectorAll(".operator-origin-row").forEach((row, i) => {
            if (i >= 3) row.remove();
          });
        },
      }),
    ]);
    return { chartsCanvas, nationalTableCanvas, regionTableCanvas };
  } catch (err) {
    console.warn("Newsletter PDF: skipping charts/table capture —", err);
    return { chartsCanvas: null, nationalTableCanvas: null, regionTableCanvas: null };
  }
}
