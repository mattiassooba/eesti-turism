// Vector tables and charts for the newsletter PDF (jsPDF primitives, no DOM
// screenshots). Each draw* function takes the jsPDF doc and a top y, draws
// fully inside the given width, and returns the y just below what it drew.
// Callers make sure the block fits on the page first (see *Height helpers).

// Site colours (prototype/src/styles/tokens.css) as RGB; jsPDF can't read
// CSS custom properties.
export const COLORS = {
  ink: [19, 42, 62],
  ink2: [75, 96, 116],
  ink3: [120, 135, 150],
  line: [221, 229, 235],
  mist: [236, 241, 245],
  pos: [43, 122, 85],
  neg: [176, 69, 58],
  c1: [59, 128, 171],
  c2: [31, 61, 90],
  c3: [127, 185, 214],
  foreign: [110, 174, 208],
};

const FONT = "helvetica";

// The standard PDF fonts only cover Windows-1252: swap the few characters
// our formatters produce outside it for printable equivalents.
export function pdfText(value) {
  if (value == null) return "—";
  return String(value)
    .replace(/−/g, "-")
    .replace(/[  ]/g, " ")
    .replace(/[  ]/g, " ");
}

export function lighten([r, g, b], amount) {
  return [r, g, b].map((c) => Math.round(c + (255 - c) * amount));
}

// Column widths for a table with a fixed label column. When the minimum
// widths don't fit, the earliest data columns are dropped (never the last);
// spare width is shared evenly among the kept columns.
export function fitColumns(labelWidth, cellWidths, available) {
  const sum = (a) => a.reduce((s, w) => s + w, 0);
  let dropFirst = 0;
  while (dropFirst < cellWidths.length - 1 && labelWidth + sum(cellWidths.slice(dropFirst)) > available) dropFirst++;
  const kept = cellWidths.slice(dropFirst);
  const spare = Math.max(0, available - labelWidth - sum(kept));
  return { widths: kept.map((w) => w + spare / kept.length), dropFirst };
}

// Round axis bounds covering [min, max] and zero, with about `ticks` steps.
export function niceScale(min, max, ticks) {
  const lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = 10 * mag;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= raw) {
      step = m * mag;
      break;
    }
  }
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

const finite = (values) => values.filter((v) => v != null && Number.isFinite(v));

function setText(doc, { size, bold = false, color = COLORS.ink }) {
  doc.setFont(FONT, bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

// ── Tables ──────────────────────────────────────────────────────────────

const ROW_H = 12.5;
const LINE_H = 8.4;
const HEAD_H = 16;

const cellText = (c) => pdfText(typeof c === "string" ? c : c?.text);
const cellLines = (c) => cellText(c).split("\n");

// Rows grow when a cell holds more than one line (e.g. country + nights).
function rowHeight(row) {
  const lines = Math.max(1, ...row.cells.map((c) => cellLines(c).length));
  return lines === 1 ? ROW_H : ROW_H + (lines - 1) * LINE_H;
}

// The header band grows for two-line column labels ("2024\nAUGUST").
function headHeight(columns) {
  const lines = Math.max(1, ...columns.map((c) => pdfText(c).split("\n").length));
  return HEAD_H + (lines - 1) * LINE_H;
}

export function tableHeight(rows, columns = []) {
  return headHeight(columns) + rows.reduce((s, r) => s + rowHeight(r), 0) + 4;
}

export function drawTable(doc, { x, y, width, columns, rows, fontSize = 7 }) {
  const pad = 6;
  doc.setFontSize(fontSize);
  const labelWidth =
    Math.max(
      ...rows.map((r) => {
        doc.setFont(FONT, r.sub ? "normal" : "bold");
        return doc.getTextWidth(pdfText(r.label)) + (r.sub ? 6 : 0);
      })
    ) + pad;
  const cellWidths = columns.map((label, j) => {
    doc.setFont(FONT, "bold");
    let w = Math.max(...pdfText(label).split("\n").map((line) => doc.getTextWidth(line)));
    doc.setFont(FONT, "normal");
    for (const r of rows) for (const line of cellLines(r.cells[j])) w = Math.max(w, doc.getTextWidth(line));
    return w + pad;
  });
  const { widths, dropFirst } = fitColumns(labelWidth, cellWidths, width);
  const cols = columns.slice(dropFirst);
  const right = widths.map((_, j) => x + labelWidth + widths.slice(0, j + 1).reduce((s, w) => s + w, 0) - pad / 2);

  // Header band; multi-line labels are bottom-aligned with single-line ones.
  const headH = headHeight(columns);
  doc.setFillColor(...COLORS.mist);
  doc.rect(x, y, width, headH, "F");
  setText(doc, { size: fontSize, bold: true, color: COLORS.ink2 });
  const lastLineY = y + headH - HEAD_H / 2 + fontSize * 0.35;
  cols.forEach((label, j) => {
    const lines = pdfText(label).split("\n");
    lines.forEach((line, k) => doc.text(line, right[j], lastLineY - (lines.length - 1 - k) * LINE_H, { align: "right" }));
  });

  let rowY = y + headH;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  for (const r of rows) {
    const h = rowHeight(r);
    const textY = rowY + ROW_H / 2 + fontSize * 0.35;
    setText(doc, { size: fontSize, bold: !r.sub, color: r.sub ? COLORS.ink3 : COLORS.ink });
    doc.text(pdfText(r.label), x + 4 + (r.sub ? 6 : 0), textY);
    r.cells.slice(dropFirst).forEach((c, j) => {
      const sign = typeof c === "object" && c ? c.sign : null;
      const color = sign > 0 ? COLORS.pos : sign < 0 ? COLORS.neg : r.sub ? COLORS.ink3 : COLORS.ink;
      setText(doc, { size: fontSize, bold: sign != null && sign !== 0, color });
      cellLines(c).forEach((line, k) => doc.text(line, right[j], textY + k * LINE_H, { align: "right" }));
    });
    rowY += h;
    doc.line(x, rowY, x + width, rowY);
  }
  doc.setTextColor(0);
  return rowY + 4;
}

// ── Charts ──────────────────────────────────────────────────────────────

const AXIS_FONT = 6.5;

// Title, wrapped subtitle and legend; returns the y where the plot starts.
function chartHeader(doc, { x, y, width, title, subtitle, legend }) {
  let cy = y;
  setText(doc, { size: 10, bold: true });
  for (const line of doc.splitTextToSize(pdfText(title), width)) {
    cy += 11;
    doc.text(line, x, cy);
  }
  if (subtitle) {
    setText(doc, { size: 7.5, color: COLORS.ink2 });
    for (const line of doc.splitTextToSize(pdfText(subtitle), width)) {
      cy += 9.5;
      doc.text(line, x, cy);
    }
  }
  if (legend?.length) {
    cy += 13;
    let lx = x;
    setText(doc, { size: 7.5, color: COLORS.ink2 });
    for (const item of legend) {
      if (item.type === "line") {
        doc.setDrawColor(...item.color);
        doc.setLineWidth(1.6);
        doc.line(lx, cy - 2.5, lx + 10, cy - 2.5);
      } else {
        doc.setFillColor(...item.color);
        doc.rect(lx, cy - 6.5, 8, 8, "F");
      }
      doc.text(pdfText(item.label), lx + 14, cy);
      lx += 14 + doc.getTextWidth(pdfText(item.label)) + 14;
    }
  }
  return cy + 8;
}

// Diagonal hatch inside a rectangle (each stroke clipped to it by hand,
// since jsPDF has no clipping for simple shapes here).
function hatch(doc, x, y, w, h, color, gap = 3.2) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.6);
  for (let d = -h; d < w; d += gap) {
    const t0 = Math.max(0, -d / h);
    const t1 = Math.min(1, (w - d) / h);
    if (t0 >= t1) continue;
    doc.line(x + d + t0 * h, y + h - t0 * h, x + d + t1 * h, y + h - t1 * h);
  }
}

export function barLineChartHeight(height = 120) {
  return height + 70;
}

// Bars on the left axis, one or more lines on the right axis (e.g. Estonia's
// guests + the county's share; occupancy + RevPAR + average price).
export function drawBarLineChart(doc, { x, y, width, height = 120, chart, barColor, lineColors, alertColor = COLORS.neg }) {
  const legend = [
    { label: chart.bars.label, color: barColor, type: "bar" },
    ...chart.lines.map((l, i) => ({ label: l.label, color: lineColors[i], type: "line" })),
  ];
  const top = chartHeader(doc, { x, y, width, title: chart.title, subtitle: chart.subtitle, legend });
  const left = x + 34;
  const plotW = width - 34 - 30;
  const bottom = top + height;
  const ls = niceScale(0, Math.max(0, ...finite(chart.bars.values)), 4);
  const rs = niceScale(0, Math.max(0, ...chart.lines.flatMap((l) => finite(l.values))), 4);
  const ly = (v) => bottom - ((v - ls.min) / (ls.max - ls.min)) * height;
  const ry = (v) => bottom - ((v - rs.min) / (rs.max - rs.min)) * height;

  setText(doc, { size: AXIS_FONT, color: COLORS.ink3 });
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  for (let v = ls.min; v <= ls.max + 1e-9; v += ls.step) {
    doc.line(left, ly(v), left + plotW, ly(v));
    doc.text(pdfText(chart.leftFormat(v, ls.step)), left - 4, ly(v) + 2, { align: "right" });
  }
  for (let v = rs.min; v <= rs.max + 1e-9; v += rs.step) {
    doc.text(pdfText(chart.rightFormat(v, rs.step)), left + plotW + 4, ry(v) + 2);
  }

  const n = chart.categories.length;
  const slot = plotW / n;
  const barW = slot * 0.62;
  const cx = (i) => left + slot * i + slot / 2;
  chart.bars.values.forEach((v, i) => {
    if (v == null) return;
    const color = chart.alert?.[i] ? alertColor : barColor;
    const h = bottom - ly(v);
    const bx = cx(i) - barW / 2;
    if (chart.partial?.[i]) {
      doc.setFillColor(...lighten(color, 0.55));
      doc.rect(bx, bottom - h, barW, h, "F");
      hatch(doc, bx, bottom - h, barW, h, color);
    } else {
      doc.setFillColor(...color);
      doc.rect(bx, bottom - h, barW, h, "F");
    }
  });

  chart.lines.forEach((line, li) => {
    const color = lineColors[li];
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(1.4);
    line.values.forEach((v, i) => {
      if (v == null) return;
      const next = line.values[i + 1];
      if (next != null && i + 1 < n) doc.line(cx(i), ry(v), cx(i + 1), ry(next));
    });
    line.values.forEach((v, i) => {
      if (v == null) return;
      doc.circle(cx(i), ry(v), 1.5, "F");
      if (line.valueFormat) {
        setText(doc, { size: 6, bold: true, color });
        doc.text(pdfText(line.valueFormat(v)), cx(i), ry(v) - 4, { align: "center" });
      }
    });
  });

  setText(doc, { size: AXIS_FONT + 0.5, color: COLORS.ink2 });
  chart.categories.forEach((label, i) => doc.text(pdfText(label), cx(i), bottom + 10, { align: "center" }));
  doc.setTextColor(0);
  return bottom + 18;
}

export function signedBarChartHeight(height = 110) {
  return height + 48;
}

// Bars above or below zero, green for growth and red for decline.
export function drawSignedBarChart(doc, { x, y, width, height = 110, chart, posColor = COLORS.pos, negColor = COLORS.neg }) {
  const top = chartHeader(doc, { x, y, width, title: chart.title, subtitle: chart.subtitle });
  const vals = finite(chart.values);
  const s = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 5);
  const left = x + 34;
  const plotW = width - 34;
  const bottom = top + height;
  const yy = (v) => bottom - ((v - s.min) / (s.max - s.min)) * height;

  setText(doc, { size: AXIS_FONT, color: COLORS.ink3 });
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  for (let v = s.min; v <= s.max + 1e-9; v += s.step) {
    doc.line(left, yy(v), left + plotW, yy(v));
    doc.text(pdfText(chart.format(v, s.step)), left - 4, yy(v) + 2, { align: "right" });
  }

  const n = chart.values.length;
  const slot = plotW / Math.max(n, 1);
  const barW = slot * 0.66;
  chart.values.forEach((v, i) => {
    if (v == null) return;
    doc.setFillColor(...(v >= 0 ? posColor : negColor));
    const y0 = yy(Math.max(v, 0));
    doc.rect(left + slot * i + (slot - barW) / 2, y0, barW, Math.abs(yy(v) - yy(0)), "F");
  });
  doc.setDrawColor(...COLORS.ink2);
  doc.setLineWidth(0.6);
  doc.line(left, yy(0), left + plotW, yy(0));

  setText(doc, { size: AXIS_FONT + 0.5, color: COLORS.ink2 });
  chart.labels.forEach((label, i) => {
    if (label) doc.text(pdfText(label), left + slot * i + slot / 2, bottom + 10, { align: "center" });
  });
  doc.setTextColor(0);
  return bottom + 18;
}
