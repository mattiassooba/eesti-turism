// Module-level cache: every NarrativeBlock instance (5 on the scroll page)
// plus the newsletter PDF download button all want the same file, so fetch
// it once per page load and share the result instead of each firing its
// own request.
let narrativePromise = null;

export function loadNarrative() {
  if (!narrativePromise) {
    narrativePromise = fetch(`${import.meta.env.BASE_URL}data/narrative.json`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return narrativePromise;
}
