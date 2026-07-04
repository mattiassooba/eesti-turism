import * as XLSX from "xlsx";

function rowsToExportData(rows) {
  return rows.map((row) => {
    const out = {};
    Object.keys(row).forEach((key) => {
      if (key.endsWith("_label")) {
        out[key.replace(/_label$/, "")] = row[key];
      }
    });
    out.value = row.value;
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
  function exportCsv() {
    const sheet = XLSX.utils.json_to_sheet(rowsToExportData(rows));
    const csv = XLSX.utils.sheet_to_csv(sheet);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${tableId}.csv`);
  }

  function exportXlsx() {
    const sheet = XLSX.utils.json_to_sheet(rowsToExportData(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, tableId.slice(0, 31));
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
      const canvas = document.createElement("canvas");
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => downloadBlob(blob, `${tableId}-chart.png`));
    };
    img.src = url;
  }

  return (
    <div className="export-buttons">
      <button onClick={exportCsv}>Export CSV</button>
      <button onClick={exportXlsx}>Export XLSX</button>
      <button onClick={exportPng}>Export PNG</button>
    </div>
  );
}
