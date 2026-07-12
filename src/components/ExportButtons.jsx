import { useTranslation } from "../i18n/LocaleContext.jsx";

function rowsToExportData(rows, valueLabel) {
  return rows.map((row) => {
    const out = {};
    Object.keys(row).forEach((key) => {
      if (key.endsWith("_label")) {
        out[key.replace(/_label$/, "")] = row[key];
      }
    });
    out[valueLabel] = row.value;
    return out;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButtons({ rows, tableId }) {
  const { t, locale } = useTranslation();
  const citation = `${t("source.prefix")} ${t("source.agency")} (andmed.stat.ee) · CC BY-SA 4.0`;

  // xlsx is a large dependency used only when a user actually exports —
  // load it on demand instead of paying for it in the main bundle.
  async function exportCsv() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rowsToExportData(rows, t("dataGrid.value")));
    const csv = XLSX.utils.sheet_to_csv(sheet);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${tableId}.csv`);
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rowsToExportData(rows, t("dataGrid.value")));
    const sourceSheet = XLSX.utils.aoa_to_sheet([
      [t("exportButtons.sourceSheetTitle")],
      [t("exportButtons.agency")],
      [`https://andmed.stat.ee/${locale}/stat`],
      [t("exportButtons.licenseLabel")],
      [t("exportButtons.licenseValue")],
      [t("exportButtons.disclaimer")],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, tableId.slice(0, 31));
    XLSX.utils.book_append_sheet(wb, sourceSheet, t("exportButtons.sourceSheetTitle"));
    XLSX.writeFile(wb, `${tableId}.xlsx`);
  }

  function exportPng() {
    const svg = document.querySelector("#chart-panel-root svg");
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const captionHeight = 24;
      const canvas = document.createElement("canvas");
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight + captionHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = "#5b6b7a";
      ctx.font = "12px 'IBM Plex Sans', sans-serif";
      ctx.fillText(citation, 8, svg.clientHeight + 16);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => downloadBlob(blob, `${tableId}-chart.png`));
    };
    img.src = url;
  }

  return (
    <div className="export-buttons">
      <button onClick={exportCsv}>{t("exportButtons.csv")}</button>
      <button onClick={exportXlsx}>{t("exportButtons.xlsx")}</button>
      <button onClick={exportPng}>{t("exportButtons.png")}</button>
    </div>
  );
}
