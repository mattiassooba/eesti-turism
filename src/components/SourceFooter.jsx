export default function SourceFooter() {
  return (
    <footer className="source-footer">
      <span>
        Allikas: Statistikaamet (Statistics Estonia) ·{" "}
        <a href="https://andmed.stat.ee/et/stat" target="_blank" rel="noreferrer">
          andmed.stat.ee
        </a>
      </span>
      <span>
        Andmed litsentsiga{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.et" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        {" "}· See rakendus ei ole Statistikaameti ametlik toode.
      </span>
    </footer>
  );
}
