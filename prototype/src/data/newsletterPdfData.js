// Everything the newsletter PDF draws on its tables and charts, as plain,
// already-formatted data. Built from the same functions as the Operator
// page (operatorTable.js), so a PDF cell always equals the page's cell.
import {
  MIN_TABLE_YEAR,
  buildColumns,
  chartYears,
  monthColLabel,
  fmtTableNum,
  shareChartSeries,
  occupancyChartSeries,
  originsByColumn,
} from "./operatorTable.js";
import { fmtAxis, fmtEur, fmtInt, fmtPct, fmtSignedPct, monthName, parsePeriod } from "../lib/format.js";
import { regionName } from "../lib/regions.js";

const CHART_YEARS = 10;
const GROWTH_QUARTERS = 36;
const PDF_ORIGINS = 3;
const COVID_YEARS = new Set([2020, 2021]);

const delta = (v, locale) => ({ text: fmtSignedPct(v, locale), sign: v == null || Number.isNaN(v) ? null : Math.sign(v) });
const price = (v, locale) => fmtEur(v, locale, v != null && Number.isInteger(v) ? 0 : 2);

function tableRows(columns, { accommodatedLabel, shareLabel, origins, locale, t }) {
  const row = (label, render, sub = false) => ({ label, sub, cells: columns.map(render) });
  const latestMonth = parsePeriod(columns.at(-1)?.key)?.month ?? 1;
  const rows = [
    row(accommodatedLabel, (c) => fmtTableNum(c.accommodated, locale)),
    row(t("operatorPage.yoyChange"), (c) => delta(c.accommodatedYoy, locale), true),
    row(t("operatorPage.cumulativeThrough", monthName(latestMonth - 1, locale, true)), (c) => fmtTableNum(c.cumulative, locale)),
    row(t("operatorPage.yoyChange"), (c) => delta(c.cumulativeYoy, locale), true),
    ...(shareLabel ? [row(shareLabel, (c) => fmtPct(c.share, locale))] : []),
    row(t("operatorPage.domesticShare"), (c) => fmtPct(c.domesticShare, locale)),
    row(t("operatorPage.establishments"), (c) => fmtTableNum(c.esta, locale)),
    row(t("operatorPage.rooms"), (c) => fmtTableNum(c.rooms, locale)),
    row(t("operatorPage.occupancy"), (c) => fmtPct(c.occ, locale)),
    row(t("operatorPage.arr"), (c) => price(c.arr, locale)),
    row(t("operatorPage.yoyChange"), (c) => delta(c.arrYoy, locale), true),
    row(t("operatorPage.revpar"), (c) => fmtEur(c.revpar, locale, 2)),
  ];
  if (origins) {
    for (let rank = 0; rank < PDF_ORIGINS; rank++) {
      rows.push(
        row(
          t("operatorPage.topOrigin", rank + 1),
          (c) => {
            const item = origins.get(c.key)?.[rank];
            return item ? `${item.label} (${fmtTableNum(item.value, locale)})` : "—";
          },
          rank > 0
        )
      );
    }
  }
  return rows;
}

function categories(years, partial) {
  return years.map((y, i) => (partial[i] ? `${y}*` : String(y)));
}

export function buildNewsletterPdfData({ tourism, capacity, sector, origins, region, locale, t }) {
  const latest = tourism.latest;
  const nationalCols = buildColumns({ tourism, capacity, code: "EE", res: "WORLD", latest, locale });
  const regionCols = buildColumns({ tourism, capacity, code: region.code, res: "WORLD", latest, locale });
  const name = regionName(region, locale);
  const isCountry = region.kind === "country";
  const span = [String(MIN_TABLE_YEAR), monthColLabel(latest, locale)];

  const years = chartYears(tourism, CHART_YEARS);
  const share = shareChartSeries({ tourism, code: region.code, years });
  const occ = occupancyChartSeries({ capacity, code: region.code, years });
  const alert = years.map((y) => COVID_YEARS.has(y));
  const eur0 = (v) => fmtEur(v, locale, 0);

  const growth = (sector?.growthSeries ?? []).slice(-GROWTH_QUARTERS);

  return {
    national: {
      title: t("operatorPage.nationalHeading", span),
      columns: nationalCols.map((c) => c.label),
      rows: tableRows(nationalCols, { accommodatedLabel: t("operatorPage.accommodatedEstonia"), locale, t }),
    },
    region: {
      code: region.code,
      name,
      title: t("operatorPage.yearlyHeading", [name, ...span]),
      columns: regionCols.map((c) => c.label),
      rows: tableRows(regionCols, {
        accommodatedLabel: t("operatorPage.accommodatedRegion", name),
        shareLabel: isCountry ? null : t("operatorPage.shareOfEstonia", name),
        origins: origins ? originsByColumn(origins, regionCols, locale, PDF_ORIGINS) : null,
        locale,
        t,
      }),
      shareChart: {
        title: t("operatorPage.trendTitle", name),
        subtitle: t("operatorPage.trendSub"),
        categories: categories(years, share.partial),
        partial: share.partial,
        alert,
        bars: { label: t("operatorPage.totalEstonia"), values: share.national },
        lines: [{ label: t("operatorPage.shareOf", name), values: isCountry ? share.national.map(() => 100) : share.sharePct }],
        leftFormat: (v) => fmtAxis(v, locale),
        rightFormat: (v) => fmtPct(v, locale, 0),
      },
      occChart: {
        title: t("operatorPage.kpiTitle", name),
        subtitle: t("operatorPage.kpiSub"),
        categories: categories(years, occ.partial),
        partial: occ.partial,
        alert,
        bars: { label: t("operatorPage.occupancyPct"), values: occ.occ },
        lines: [
          { label: t("operatorPage.revparShort"), values: occ.revpar, valueFormat: eur0 },
          { label: t("operatorPage.avgNightRate"), values: occ.arr },
        ],
        leftFormat: (v) => `${fmtInt(v, locale)}%`,
        rightFormat: (v) => `${fmtInt(v, locale)} €`,
      },
    },
    growth: {
      title: t("sectorPage.growthTitle"),
      subtitle: t("sectorPage.growthSub"),
      labels: growth.map((p) => (p.period.endsWith("Q1") ? p.period.slice(0, 4) : "")),
      values: growth.map((p) => p.pct),
      format: (v) => `${fmtInt(v, locale)}%`,
    },
  };
}
