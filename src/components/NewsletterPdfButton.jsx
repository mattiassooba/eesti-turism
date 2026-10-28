import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { useRegion } from "../context/RegionContext.jsx";
import { countyLabelByCode } from "../data/counties";
import { loadNarrative } from "../data/narrative";
import {
  COLORS,
  drawTable,
  tableHeight,
  drawBarLineChart,
  barLineChartHeight,
  drawSignedBarChart,
  signedBarChartHeight,
  pdfText,
} from "./pdfDraw.js";

const MARGIN = 48;
const LINE_HEIGHT = 14;
// Match --ink / --positive / --alert / --sea from src/styles/tokens.css —
// jsPDF has no access to CSS custom properties, so these are kept in sync
// by hand the same way the chart colors above already are.
const INK_COLOR = [16, 27, 38];
const POSITIVE_COLOR = [31, 122, 82];
const NEGATIVE_COLOR = [156, 59, 38];
const SEA_COLOR = [43, 108, 163];

// Only enabled once narrative.json is confirmed present — same
// graceful-degradation stance as NarrativeBlock (no error UI, just no
// button, before the first scheduled generation has ever run).
// pdfData: the tables and charts, prepared by the prototype's Reports page
// (prototype/src/data/newsletterPdfData.js); null until its data loads.
export default function NewsletterPdfButton({ pdfData = null }) {
  const { t, locale } = useTranslation();
  const { region, isExplicitRegion } = useRegion();
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
        y += 5;
      }

      // Bold headline restating the single most-important ranked finding
      // (Task 3.1) — the first thing a reader sees after the brand line,
      // instead of a generic "here's your report" intro.
      function headline(text) {
        if (!text) return;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT + 4);
          doc.setTextColor(...INK_COLOR);
          doc.text(line, MARGIN, y);
          y += LINE_HEIGHT + 4;
        }
        doc.setTextColor(0);
        y += 6;
      }

      // A short bulleted list (Task 3.1's "key insights") — a sea-colored
      // dot instead of a text bullet character, kept out of the running
      // text font so it never gets mistaken for punctuation.
      function bulletLine(text) {
        const indent = 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(text, maxWidth - indent);
        ensureSpace(LINE_HEIGHT * lines.length + 6);
        doc.setFillColor(...SEA_COLOR);
        doc.circle(MARGIN + 3, y - 3, 1.6, "F");
        doc.setTextColor(20);
        for (const line of lines) {
          doc.text(line, MARGIN + indent, y);
          y += LINE_HEIGHT;
        }
        doc.setTextColor(0);
        y += 5;
      }

      // One KPI tile: label, big value, colored YoY delta — drawn with
      // jsPDF's own vector primitives (no DOM/canvas dependency), so it's
      // always available regardless of which tab the reader has open, and
      // reads crisply at any zoom instead of as a rasterized screenshot.
      function kpiCard(x, cardWidth, cardHeight, { label, value, delta, deltaIsPoints = false }) {
        const pad = 10;
        doc.setDrawColor(222, 224, 222);
        doc.setLineWidth(0.75);
        doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text(label, x + pad, y + 15);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...INK_COLOR);
        doc.text(value, x + pad, y + 33);
        const deltaY = Math.min(y + 49, y + cardHeight - 8);
        if (delta != null) {
          const positive = delta >= 0;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(...(positive ? POSITIVE_COLOR : NEGATIVE_COLOR));
          const sign = positive ? "+" : "";
          const deltaText = `${sign}${delta.toFixed(1)}${deltaIsPoints ? " p" : "%"} YoY`;
          doc.text(deltaText, x + pad, deltaY);
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(150);
          doc.text("n/a", x + pad, deltaY);
        }
        doc.setTextColor(0);
      }

      // A row of up to 4 equal-width KPI cards (Task 3.1's page-1 KPI
      // cards) — cards share one y so kpiCard() above must be called with
      // the row already at the current y; this is the only place y moves.
      function kpiCardRow(cards, { height = 60, cardGap = 10 } = {}) {
        ensureSpace(height + 16);
        const cardWidth = (maxWidth - cardGap * (cards.length - 1)) / cards.length;
        cards.forEach((card, i) => kpiCard(MARGIN + i * (cardWidth + cardGap), cardWidth, height, card));
        y += height + 16;
      }

      // A lean, fully-vector label/value/delta table for the region page,
      // built straight from narrative.json's `facts`.
      function leanKpiTable(rows) {
        const rowHeight = 18;
        const valueX = MARGIN + maxWidth * 0.52;
        const deltaX = MARGIN + maxWidth - 64;
        rows.forEach((row, i) => {
          ensureSpace(rowHeight);
          if (i % 2 === 1) {
            doc.setFillColor(246, 247, 246);
            doc.rect(MARGIN, y - 12, maxWidth, rowHeight, "F");
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(70);
          doc.text(row.label, MARGIN + 6, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...INK_COLOR);
          doc.text(row.value, valueX, y);
          if (row.delta != null) {
            const positive = row.delta >= 0;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...(positive ? POSITIVE_COLOR : NEGATIVE_COLOR));
            const sign = positive ? "+" : "";
            doc.text(`${sign}${row.delta.toFixed(1)}${row.deltaIsPoints ? " p" : "%"}`, deltaX, y);
          }
          doc.setTextColor(0);
          y += rowHeight;
        });
        y += 8;
      }

      // "1.2M" / "650k": kept short for the KPI tiles.
      function abbrevShort(n) {
        if (n == null) return "";
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
        return String(Math.round(n));
      }

      // Heading + paragraph for an optional narrative field: skipped when an
      // older narrative.json doesn't have it yet.
      function optionalParagraph(heading, text) {
        if (!text) return false;
        ensureSpace(LINE_HEIGHT * 4);
        paragraph(heading, { font: "bold", size: 12, gap: 4 });
        paragraph(text, { size: 9.5, gap: 8 });
        return true;
      }

      function table(tbl) {
        if (!tbl) return;
        ensureSpace(tableHeight(tbl.rows, tbl.columns) + 40);
        paragraph(tbl.title, { font: "bold", size: 10.5, gap: 2 });
        y = drawTable(doc, { x: MARGIN, y, width: maxWidth, columns: tbl.columns, rows: tbl.rows }) + 6;
        paragraph(t("newsletterPdf.tableNote"), { font: "italic", size: 7, color: 130, gap: 10 });
      }

      function barLineChart(chart, colors) {
        if (!chart) return;
        ensureSpace(barLineChartHeight(115));
        y = drawBarLineChart(doc, { x: MARGIN, y, width: maxWidth, height: 115, chart, ...colors }) + 12;
      }

      const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;
      const dashboard = narrative.sections.dashboard;
      const facts = narrative.facts ?? null;
      const headlineText = narrative.sections.headline?.[locale] ?? narrative.sections.headline?.et;
      const keyInsights = (narrative.sections.keyInsights ?? []).map((k) => k[locale] ?? k.et).filter(Boolean);

      // Page 2's region comes with the prepared data (the reader's selected
      // region, else the county the narrative pipeline featured), so its text,
      // KPIs, charts and table always describe the same place.
      const fallbackCode = isExplicitRegion ? region : narrative.featuredRegionCode ?? region;
      const effectiveRegionCode = pdfData?.region.code ?? fallbackCode;
      const regionLabel = pdfData?.region.name ?? countyLabelByCode(effectiveRegionCode, locale);
      const regionBlurb = narrative.sections.dashboardByRegion?.[effectiveRegionCode];
      const regionFacts = facts?.regions?.[effectiveRegionCode] ?? null;
      const pick = (section) => section?.[locale] ?? section?.et;
      const expensesHighlight = narrative.sections.expenses?.[locale === "en" ? "highlightEn" : "highlightEt"];

      const footerNotes = [];

      // ---- Page 1: Estonia in general ---------------------------------
      paragraph(`${t("app.brand")} — ${periodLabel}`, { font: "bold", size: 20, gap: 4 });
      headline(headlineText);
      paragraph(t("newsletterPdf.intro"), { font: "italic", size: 8.5, color: 120, gap: 10 });

      if (facts) {
        kpiCardRow([
          {
            label: t("newsletterPdf.kpi.guests"),
            value: abbrevShort(facts.national.totalGuests),
            delta: facts.national.totalGuestsYoyPct,
          },
          {
            label: t("newsletterPdf.kpi.nights"),
            value: abbrevShort(facts.national.totalNights),
            delta: facts.national.totalNightsYoyPct,
          },
          {
            label: t("newsletterPdf.kpi.occupancy"),
            value: facts.national.occupancyPct != null ? `${facts.national.occupancyPct.toFixed(0)}%` : "n/a",
            delta: facts.national.occupancyPctYoy,
            deltaIsPoints: true,
          },
          {
            label: t("newsletterPdf.kpi.avgCost"),
            value: facts.national.avgNightCost != null ? `€${facts.national.avgNightCost.toFixed(0)}` : "n/a",
            delta: facts.national.avgNightCostYoyPct,
          },
        ]);
      }

      if (keyInsights.length) {
        paragraph(t("newsletterPdf.keyInsightsHeading"), { font: "bold", size: 12, gap: 4 });
        for (const insight of keyInsights) bulletLine(insight);
      }

      paragraph(t("newsletterPdf.estoniaHeading"), { font: "bold", size: 13, gap: 5 });
      if (dashboard) paragraph(dashboard[locale] ?? dashboard.et, { size: 9.5, gap: 8 });

      table(pdfData?.national);

      // The turnover chart shows even before the narrative has a sector
      // paragraph (older narrative.json).
      if (pdfData?.growth.values.length) {
        ensureSpace(signedBarChartHeight(105) + LINE_HEIGHT * 6);
        paragraph(t("newsletterPdf.sectorHeading"), { font: "bold", size: 12, gap: 4 });
        const sectorText = pick(narrative.sections.sector);
        if (sectorText) paragraph(sectorText, { size: 9.5, gap: 6 });
        y = drawSignedBarChart(doc, { x: MARGIN, y, width: maxWidth, height: 105, chart: pdfData.growth }) + 12;
      }
      optionalParagraph(t("newsletterPdf.spendingHeading"), expensesHighlight);

      const generatedDate = new Date(narrative.generatedAt).toLocaleDateString(
        locale === "en" ? "en-US" : "et-EE"
      );
      footerNotes.push(`${t("newsletterPdf.generatedOn")} ${generatedDate}`);

      // ---- Page 2: the selected region in detail ------------------------
      doc.addPage();
      y = MARGIN;

      paragraph(regionLabel, { font: "bold", size: 18, gap: 4 });
      paragraph(t("newsletterPdf.regionSubheading"), { font: "normal", size: 11, color: 110, gap: 14 });

      if (regionBlurb) paragraph(regionBlurb[locale] ?? regionBlurb.et, { gap: 16 });

      if (regionFacts) {
        paragraph(t("newsletterPdf.regionSnapshotHeading"), { font: "bold", size: 11, gap: 6 });
        leanKpiTable(
          [
            { label: t("newsletterPdf.kpi.guests"), value: abbrevShort(regionFacts.totalGuests), delta: regionFacts.totalGuestsYoyPct },
            { label: t("newsletterPdf.kpi.nights"), value: abbrevShort(regionFacts.totalNights), delta: regionFacts.totalNightsYoyPct },
            { label: t("newsletterPdf.kpi.domestic"), value: abbrevShort(regionFacts.domesticGuests), delta: regionFacts.domesticGuestsYoyPct },
            { label: t("newsletterPdf.kpi.foreign"), value: abbrevShort(regionFacts.foreignGuests), delta: regionFacts.foreignGuestsYoyPct },
            {
              label: t("newsletterPdf.kpi.avgStay"),
              value: regionFacts.avgNightsPerGuest != null ? regionFacts.avgNightsPerGuest.toFixed(2) : "n/a",
              delta: regionFacts.avgNightsPerGuestYoyPct,
            },
            {
              label: t("newsletterPdf.kpi.occupancy"),
              value: regionFacts.occupancyPct != null ? `${regionFacts.occupancyPct.toFixed(0)}%` : "n/a",
              delta: regionFacts.occupancyPctYoy,
              deltaIsPoints: true,
            },
            {
              label: t("newsletterPdf.kpi.avgCost"),
              value: regionFacts.avgNightCost != null ? `€${regionFacts.avgNightCost.toFixed(0)}` : "n/a",
              delta: regionFacts.avgNightCostYoyPct,
            },
          ].filter((row) => row.value !== "n/a")
        );
      }

      barLineChart(pdfData?.region.shareChart, { barColor: COLORS.c1, lineColors: [COLORS.foreign] });
      barLineChart(pdfData?.region.occChart, { barColor: COLORS.c3, lineColors: [COLORS.c1, COLORS.c2] });
      table(pdfData?.region);

      footerNotes.push(`${t("source.prefix")} ${t("source.agency")}, ${t("source.tables")} TU131, TU122, TU410, TU552`);

      // ---- Page numbers + footer link on every page ----------------------
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const footerY = pageHeight - 24;
        doc.setDrawColor(224, 226, 224);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, footerY - 10, MARGIN + maxWidth, footerY - 10);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(footerNotes[i - 1] ?? "", MARGIN, footerY);

        const pageText = `${t("newsletterPdf.pageLabel")} ${i}/${totalPages}`;
        const linkText = "turismistatistika.ee";
        const linkWidth = doc.getTextWidth(linkText);
        doc.setFont("helvetica", "normal");
        doc.text(pageText, MARGIN + maxWidth - linkWidth - doc.getTextWidth(pageText) - 14, footerY);
        doc.setTextColor(...SEA_COLOR);
        doc.textWithLink(linkText, MARGIN + maxWidth - linkWidth, footerY, { url: "https://turismistatistika.ee" });
        doc.setTextColor(0);
      }

      doc.save(`eesti-turism-${narrative.period}-${locale}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button type="button" className="newsletter-pdf-button" onClick={download} disabled={generating || !pdfData}>
      {generating ? t("newsletterPdf.generating") : pdfData ? t("newsletterPdf.download") : t("newsletterPdf.preparing")}
    </button>
  );
}
