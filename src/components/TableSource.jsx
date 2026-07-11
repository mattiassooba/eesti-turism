// Statistikaamet's human-browsable table pages follow this path shape —
// the same folder segments the API uses, joined with "__", plus the
// table id without its .px/.PX extension.
function buildBrowseUrl(pathSegments, tableId) {
  const cleanId = tableId.replace(/\.px$/i, "");
  return `https://andmed.stat.ee/et/stat/${pathSegments.join("__")}/${cleanId}`;
}

export default function TableSource({ path, ids, dark = false }) {
  return (
    <div className={"table-source" + (dark ? " table-source-dark" : "")}>
      Allikas: <strong>Statistikaamet</strong>, {ids.length > 1 ? "tabelid" : "tabel"}{" "}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ", "}
          <a href={buildBrowseUrl(path, id)} target="_blank" rel="noreferrer">
            {id}
          </a>
        </span>
      ))}
    </div>
  );
}
