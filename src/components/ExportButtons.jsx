const CITATION = "Allikas: Statistikaamet (andmed.stat.ee) · CC BY-SA 4.0";

function rowsToExportData(rows) {
  return rows.map((row) => {
    const out = {};
    Object.keys(row).forEach((key) => {
      if (key.endsWith("_label")) {
        out[key.replace(/_label$/, "")] = row[key];
      }
    });
    out["Väärtus"] = row.value;
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
  // xlsx is a large dependency used only when a user actually exports —
  // load it on demand instead of paying for it in the main bundle.
  async function exportCsv() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rowsToExportData(rows));
    const csv = XLSX.utils.sheet_to_csv(sheet);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${tableId}.csv`);
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rowsToExportData(rows));
    const sourceSheet = XLSX.utils.aoa_to_sheet([
      ["Allikas"],
      ["Statistikaamet (Statistics Estonia)"],
      ["https://andmed.stat.ee/et/stat"],
      ["Litsents"],
      ["CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/deed.et"],
      ["See rakendus ei ole Statistikaameti ametlik toode."],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, tableId.slice(0, 31));
    XLSX.utils.book_append_sheet(wb, sourceSheet, "Allikas");
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
      ctx.fillText(CITATION, 8, svg.clientHeight + 16);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => downloadBlob(blob, `${tableId}-chart.png`));
    };
    img.src = url;
  }

  return (
    <div className="export-buttons">
      <button onClick={exportCsv}>Laadi alla CSV</button>
      <button onClick={exportXlsx}>Laadi alla XLSX</button>
      <button onClick={exportPng}>Laadi alla PNG</button>
    </div>
  );
}
