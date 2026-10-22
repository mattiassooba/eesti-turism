import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { useRegion } from "../context/RegionContext.jsx";
import { countyLabelByCode } from "../data/counties";
import { loadNarrative } from "../data/narrative";

const MARGIN = 48;
const LINE_HEIGHT = 14;
// Match DOMESTIC_COLOR / FOREIGN_COLOR from src/theme.js, used everywhere
// else in the app for this exact residents-vs-foreign-visitors split.
const DOMESTIC_LINE_COLOR = [91, 107, 122];
const FOREIGN_LINE_COLOR = [217, 142, 43];
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
export default function NewsletterPdfButton() {
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

      // Small uppercase tracked label ("EESTI TURISM • AUGUST 2026") above
      // the headline — jsPDF's `charSpace` text option gives the letter-
      // spacing a plain doc.text() can't.
      function eyebrow(text) {
        ensureSpace(LINE_HEIGHT);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...SEA_COLOR);
        doc.text(text.toUpperCase(), MARGIN, y, { charSpace: 1.1 });
        doc.setTextColor(0);
        y += 18;
      }

      // Bold headline restating the single most-important ranked finding
      // (Task 3.1) — now the dominant element on the page (Task 3.1's
      // revised layout puts the brand/period line above it as a small
      // eyebrow instead of the page's main title).
      function headline(text) {
        if (!text) return;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(19);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT + 6);
          doc.setTextColor(...INK_COLOR);
          doc.text(line, MARGIN, y);
          y += LINE_HEIGHT + 6;
        }
        doc.setTextColor(0);
        y += 4;
      }

      // Secondary, deterministic (non-AI) line under the headline — the
      // nights YoY figure plus the stay-length implication, built straight
      // from `facts`, the same way KPI cards are, not from Claude. Mirrors
      // the headline's own "restate the #1 finding" role for the #2 story
      // (nights/stay-length) without needing another Claude field.
      function subheadline(n, loc) {
        if (!n || n.totalNightsYoyPct == null) return;
        const nightsPct = n.totalNightsYoyPct;
        const stayPct = n.avgNightsPerGuestYoyPct;
        const nightsLabel = loc === "en" ? "Nights" : "Ööbimiste arv";
        const nightsVerb = loc === "en" ? (nightsPct >= 0 ? "grew" : "fell") : nightsPct >= 0 ? "kasvas" : "vähenes";
        const pctText = `${Math.abs(nightsPct).toFixed(1)}%`;
        let stayClause = "";
        if (stayPct != null) {
          const intense = Math.abs(stayPct) >= 5;
          if (loc === "en") {
            const verb = stayPct >= 0 ? "lengthened" : "shortened";
            stayClause = ` — stays ${verb} ${intense ? "notably" : "slightly"}`;
          } else {
            const verb = stayPct >= 0 ? "pikenesid" : "lühenesid";
            stayClause = ` — külastused ${verb} ${intense ? "märgatavalt" : "veidi"}`;
          }
        }
        paragraph(`${nightsLabel} ${nightsVerb} ${pctText}${stayClause}.`, {
          font: "normal",
          size: 11.5,
          color: 75,
          gap: 16,
        });
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
        // `delta` omitted entirely (not just null) skips this row, for a
        // shorter card showing just a label and a value — used for the
        // page-1 snapshot cards, where the headline/subheadline above
        // already carry the period's two most important YoY deltas.
        if (delta !== undefined) {
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

      // A lean, fully-vector label/value/delta table (Task 3.4's "leaner
      // tables") for the region page — unlike the html2canvas table
      // capture below it, this one is correct for ANY region regardless of
      // which county is actually selected on screen, since it's built
      // straight from narrative.json's `facts`, not a DOM screenshot.
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
        // JPEG at high (not max) quality — this is a chart/table screenshot
        // with small text, where compression artifacts read as blur, but a
        // lossless PNG at this resolution ran 10+ MB.
        doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, drawWidth, drawHeight);
        y += drawHeight + gap;
      }

      // Drawn with jsPDF's own vector primitives, not a DOM screenshot — the
      // only fully-national charts in the app live on the lazy-mounted Map
      // tab, so a live capture would frequently just be missing. This has
      // no DOM dependency at all and works regardless of which tab is open.
      // "1.2M" / "650k" — kept locale-agnostic and as short as possible,
      // since these are squeezed into narrow bar segments, not prose.
      function abbrevShort(n) {
        if (n == null) return "";
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
        return String(Math.round(n));
      }

      // A 36-month domestic-vs-foreign line chart — replaces the old
      // annual stacked-bar chart so the trend reads as a continuous,
      // seasonal line (matching the reference layout) instead of yearly
      // totals. Unlike the old annual series, every monthly point is a
      // complete calendar month, so there's no "partial period" to flag.
      function monthlyTrendChart(series, { height = 100, gap = 14 } = {}) {
        if (!Array.isArray(series) || series.length < 2) return;
        const topPadding = 10;
        const labelGutter = 40; // room for the two end-of-line value labels
        const chartWidth = maxWidth - labelGutter;
        ensureSpace(height + topPadding + 32);
        const top = y + topPadding;
        const axisY = top + height;
        const maxVal = Math.max(...series.flatMap((d) => [d.domestic, d.foreign]), 1);
        const valueToY = (v) => axisY - (v / maxVal) * height;
        const stepX = chartWidth / (series.length - 1);
        const xAt = (i) => MARGIN + i * stepX;

        // Dashed horizontal gridlines, matching the reference's light,
        // recessive grid — drawn before the lines so the lines sit on top.
        doc.setDrawColor(226, 228, 226);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([2, 2], 0);
        const gridBands = 3;
        for (let g = 1; g <= gridBands; g++) {
          const gy = top + (height / gridBands) * (g - 1);
          doc.line(MARGIN, gy, MARGIN + chartWidth, gy);
        }
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(200);
        doc.line(MARGIN, axisY, MARGIN + chartWidth, axisY);

        function drawLine(values, color) {
          doc.setDrawColor(...color);
          doc.setLineWidth(1.6);
          for (let i = 0; i < values.length - 1; i++) {
            doc.line(xAt(i), valueToY(values[i]), xAt(i + 1), valueToY(values[i + 1]));
          }
        }
        drawLine(
          series.map((d) => d.domestic),
          DOMESTIC_LINE_COLOR
        );
        drawLine(
          series.map((d) => d.foreign),
          FOREIGN_LINE_COLOR
        );

        // End-of-line value labels — nudged apart if the two lines finish
        // close together, so neither label sits on top of the other.
        const last = series[series.length - 1];
        const domesticY = valueToY(last.domestic);
        const foreignY = valueToY(last.foreign);
        const tooClose = Math.abs(domesticY - foreignY) < 9;
        const domesticLabelY = tooClose && domesticY > foreignY ? domesticY + 5 : domesticY + 3;
        const foreignLabelY = tooClose && foreignY >= domesticY ? foreignY + 5 : foreignY + 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...DOMESTIC_LINE_COLOR);
        doc.text(abbrevShort(last.domestic), MARGIN + chartWidth + 4, domesticLabelY);
        doc.setTextColor(...FOREIGN_LINE_COLOR);
        doc.text(abbrevShort(last.foreign), MARGIN + chartWidth + 4, foreignLabelY);
        doc.setTextColor(0);

        // X-axis: one label per calendar year, placed at that year's first
        // point in the window — only at an actual January, never guessed
        // at the window's own start (which usually isn't January), so
        // every label means the same thing.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(110);
        let lastYearLabeled = null;
        series.forEach((d, i) => {
          const year = d.period.slice(0, 4);
          const month = d.period.slice(5, 7);
          if (year !== lastYearLabeled && month === "01") {
            doc.text(year, xAt(i), axisY + 12, { align: "center" });
            lastYearLabeled = year;
          }
        });
        doc.setTextColor(0);

        const legendY = axisY + 28;
        doc.setFillColor(...DOMESTIC_LINE_COLOR);
        doc.rect(MARGIN, legendY - 7, 8, 8, "F");
        doc.setFontSize(8.5);
        doc.text(t("common.domestic"), MARGIN + 12, legendY);
        const legendGap = MARGIN + 12 + doc.getTextWidth(t("common.domestic")) + 16;
        doc.setFillColor(...FOREIGN_LINE_COLOR);
        doc.rect(legendGap, legendY - 7, 8, 8, "F");
        doc.text(t("common.foreign"), legendGap + 12, legendY);

        y = legendY + gap;
      }

      const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;
      const dashboard = narrative.sections.dashboard;
      const facts = narrative.facts ?? null;
      const headlineText = narrative.sections.headline?.[locale] ?? narrative.sections.headline?.et;
      const keyInsights = (narrative.sections.keyInsights ?? []).map((k) => k[locale] ?? k.et).filter(Boolean);

      // Which county page 2 covers: if the reader explicitly picked one
      // (they're on /maakond/:slug), that choice is preserved exactly as
      // before. Otherwise (the generic root dashboard) it falls back to
      // the most newsworthy county this period, computed from the ranked
      // findings server-side, instead of always defaulting to Harju —
      // see RegionContext.jsx's isExplicitRegion and the spec's "PDF
      // always defaults to Harju" complaint.
      const effectiveRegionCode = isExplicitRegion ? region : narrative.featuredRegionCode ?? region;
      const regionLabel = countyLabelByCode(effectiveRegionCode, locale);
      const regionBlurb = narrative.sections.dashboardByRegion?.[effectiveRegionCode];
      const regionFacts = facts?.regions?.[effectiveRegionCode] ?? null;

      // The on-screen Ülevaade charts/tables only ever show the region
      // currently selected in the "Vali maakond" selector (`region`) — so
      // a DOM screenshot is only trustworthy when that's the SAME region
      // this PDF page is actually about. When the PDF has picked a more
      // newsworthy county than what happens to be on screen, the lean
      // native table below (built from `facts`, not the DOM) is used
      // instead, so the numbers and the region name never contradict.
      const canCaptureRegionDom = effectiveRegionCode === region;
      const { chartsCanvas, nationalTableCanvas, regionTableCanvas } = await captureOperatorSnapshots();

      const footerNotes = [];

      // ---- Page 1: Estonia in general ---------------------------------
      eyebrow(`${t("app.brand")} • ${periodLabel}`);
      headline(headlineText);
      if (facts) subheadline(facts.national, locale);

      if (facts) {
        const foreignSharePct =
          facts.national.totalGuests ? (facts.national.foreignGuests / facts.national.totalGuests) * 100 : null;
        kpiCardRow(
          [
            { label: t("newsletterPdf.kpi.guests"), value: abbrevShort(facts.national.totalGuests) },
            { label: t("newsletterPdf.kpi.nights"), value: abbrevShort(facts.national.totalNights) },
            {
              label: t("newsletterPdf.kpi.foreignShare"),
              value: foreignSharePct != null ? `${foreignSharePct.toFixed(0)}%` : "n/a",
            },
          ],
          { height: 46 }
        );
      }

      paragraph(t("newsletterPdf.trendChartTitle"), { font: "bold", size: 12, gap: 6 });
      monthlyTrendChart(dashboard?.nationalMonthlyTrend, { height: 95, gap: 18 });

      if (keyInsights.length) {
        paragraph(t("newsletterPdf.keyInsightsHeading"), { font: "bold", size: 12, gap: 4 });
        for (const insight of keyInsights) bulletLine(insight);
        y += 4;
      }

      if (nationalTableCanvas) image(nationalTableCanvas, { maxHeight: 135, gap: 10 });

      paragraph(t("newsletterPdf.intro"), { font: "italic", size: 8, color: 130, gap: 4 });

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

      if (canCaptureRegionDom && chartsCanvas) image(chartsCanvas, { maxHeight: 190 });
      if (canCaptureRegionDom && regionTableCanvas) image(regionTableCanvas, { maxHeight: 200 });
      if (!canCaptureRegionDom) {
        paragraph(t("newsletterPdf.viewChartsOnSite"), { font: "italic", size: 8.5, color: 130, gap: 0 });
      }

      footerNotes.push(`${t("source.prefix")} ${t("source.agency")}, ${t("source.tables")} TU131.PX, TU122.PX`);

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
    // scale: 3 (not the default 1 or the old 1.5) — these tables carry small
    // (11-12px) text that reads as blurry once rasterized and squeezed to
    // page width; a higher source resolution keeps that text sharp at the
    // size it's actually printed at.
    const capture = (node) => (node ? html2canvas(node, { scale: 3, backgroundColor: "#ffffff" }) : null);
    // Both yearly tables scroll horizontally on screen (many year columns)
    // — a plain capture only grabs the visible viewport and silently drops
    // whatever's scrolled out of view. Forcing the clone's width to the
    // wrapper's full scrollWidth (and disabling its overflow clipping)
    // makes html2canvas render — and capture — every column.
    const captureFullWidthTable = (node, { onclone } = {}) =>
      node
        ? html2canvas(node, {
            scale: 3,
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
