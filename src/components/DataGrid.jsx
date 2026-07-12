import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useTranslation } from "../i18n/LocaleContext.jsx";

export default function DataGrid({ rows }) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState([]);

  const columns = useMemo(() => {
    if (!rows.length) return [];
    const labelKeys = Object.keys(rows[0]).filter((k) => k.endsWith("_label"));
    return [
      ...labelKeys.map((key) => ({
        accessorKey: key,
        header: key.replace(/_label$/, ""),
      })),
      { accessorKey: "value", header: t("dataGrid.value") },
    ];
  }, [rows, t]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!rows.length) return <div className="panel-status">{t("dataGrid.noData")}</div>;

  return (
    <div className="data-grid-wrapper">
    <table className="data-grid">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                {flexRender(header.column.columnDef.header, header.getContext())}
                {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted()] ?? ""}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
