# Tourism Statistics UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static React + Vite app that browses Statistics Estonia's
tourism/accommodation data (Turism, majutus ja toitlustus) directly from
the PxWeb API, with a folder tree, filterable datasheet, line/bar charts,
and CSV/XLSX/PNG export.

**Architecture:** Single-page app, no backend. The browser calls
`andmed.stat.ee`'s PxWeb REST API directly (CORS is enabled server-side).
A thin API client module wraps the three PxWeb operations (list folder,
get table metadata, POST a data query); a parsing module flattens the
`json-stat2` response into rows/chart series; UI components layer on top.

**Tech Stack:** React 18, Vite 5, Recharts (charts), @tanstack/react-table
(sortable grid), xlsx/SheetJS (CSV/XLSX export). No test framework —
verification is manual per task, per the approved design spec.

## Global Constraints

- Root data path: `majandus/turism-ja-majutus` (folder segments, joined
  with `/` for API URLs).
- API base: `https://andmed.stat.ee/api/v1/et/stat` — always request the
  Estonian (`et`) locale.
- Data POST requests always request `response.format: "json-stat2"`.
- No backend/proxy — all API calls happen client-side; this relies on the
  API's `CORS: true` config (confirmed live).
- No automated test framework. Every task ends with a manual verification
  step (a runnable command with expected output, or a browser check) —
  per the design spec's "Testing" section, which explicitly scopes out
  an automated suite for this personal test tool.
- Node 24 is available in the dev environment (has global `fetch`).
- Project root is the repository root (no `frontend/` subfolder) — this
  repo currently only contains `docs/`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx` (placeholder, replaced in Task 9)
- Create: `src/App.css` (placeholder, replaced in Task 9)
- Create: `.gitignore`

**Interfaces:**
- Produces: a working Vite dev server (`npm run dev`) and build
  (`npm run build`) that later tasks add files into.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tourism-stats-ui",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7",
    "@tanstack/react-table": "^8.20.5",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="et">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tourism Statistics</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `src/main.jsx`**

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Create placeholder `src/App.jsx`**

```jsx
export default function App() {
  return <div style={{ padding: 16 }}>Tourism Statistics UI — scaffold OK</div>;
}
```

- [ ] **Step 6: Create placeholder `src/App.css`**

```css
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
dist
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: exits 0, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Verify the dev server starts and serves the placeholder**

Run: `npm run dev -- --port 5173 &` then, after a couple seconds,
`curl -s http://localhost:5173/ | grep -o '<title>[^<]*</title>'`,
then stop the dev server (`kill %1` or equivalent for the shell in use).
Expected output: `<title>Tourism Statistics</title>`.

- [ ] **Step 10: Verify the production build succeeds**

Run: `npm run build`
Expected: exits 0, prints a summary ending in something like
`dist/assets/index-*.js` with no errors.

- [ ] **Step 11: Commit**

```bash
git add package.json vite.config.js index.html src/main.jsx src/App.jsx src/App.css .gitignore package-lock.json
git commit -m "chore: scaffold Vite + React project"
```

---

### Task 2: PxWeb API client

**Files:**
- Create: `src/api/pxweb.js`

**Interfaces:**
- Produces:
  - `fetchLevel(pathSegments: string[]): Promise<Array<{id: string, type: "l"|"t", text: string, updated?: string}>>`
  - `fetchTableMeta(pathSegments: string[], tableId: string): Promise<{title: string, variables: Array<{code: string, text: string, values: string[], valueTexts: string[], time?: boolean, elimination?: boolean}>}>`
  - `fetchTableData(pathSegments: string[], tableId: string, query: Array<{code: string, selection: {filter: string, values: string[]}}>): Promise<object>` (raw json-stat2 dataset)

- [ ] **Step 1: Write `src/api/pxweb.js`**

```js
const API_BASE = "https://andmed.stat.ee/api/v1/et/stat";

function buildUrl(pathSegments, tableId) {
  const parts = tableId ? [...pathSegments, tableId] : pathSegments;
  return parts.length ? `${API_BASE}/${parts.join("/")}` : API_BASE;
}

export async function fetchLevel(pathSegments) {
  const url = buildUrl(pathSegments);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch level ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableMeta(pathSegments, tableId) {
  const url = buildUrl(pathSegments, tableId);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch table metadata ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableData(pathSegments, tableId, query) {
  const url = buildUrl(pathSegments, tableId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch table data ${url}: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Verify `fetchLevel` against the real API**

Run:
```bash
node -e "
import('./src/api/pxweb.js').then(async (m) => {
  const levels = await m.fetchLevel(['majandus', 'turism-ja-majutus']);
  console.log(levels.map((l) => l.id).sort().join(','));
});
"
```
Expected output: `eesti-elanike-reisimine,majutus,turismi-ja-majutuse-majandusnaitajad`

- [ ] **Step 3: Verify `fetchTableMeta` against the real API**

Run:
```bash
node -e "
import('./src/api/pxweb.js').then(async (m) => {
  const meta = await m.fetchTableMeta(['majandus', 'turism-ja-majutus', 'majutus'], 'TU121.PX');
  console.log(meta.title);
  console.log(meta.variables.map((v) => v.code).join(','));
});
"
```
Expected output:
```
TU121: MAJUTATUD (KUUD)
Vaatlusperiood,Näitaja
```

- [ ] **Step 4: Verify `fetchTableData` against the real API**

Run:
```bash
node -e "
import('./src/api/pxweb.js').then(async (m) => {
  const data = await m.fetchTableData(
    ['majandus', 'turism-ja-majutus', 'majutus'],
    'TU121.PX',
    [{ code: 'Vaatlusperiood', selection: { filter: 'top', values: ['3'] } }]
  );
  console.log(data.class, JSON.stringify(data.size));
});
"
```
Expected output: `dataset [3,3]`

- [ ] **Step 5: Commit**

```bash
git add src/api/pxweb.js
git commit -m "feat: add PxWeb API client"
```

---

### Task 3: json-stat2 parsing utilities

**Files:**
- Create: `src/api/jsonStat.js`

**Interfaces:**
- Consumes: raw json-stat2 dataset objects as returned by
  `fetchTableData` (Task 2).
- Produces:
  - `flattenToRows(dataset: object): Array<Record<string, string|number>>` —
    one row per data point; for each dimension code `D` in `dataset.id`,
    the row has `D` (category key) and `D_label` (category label), plus
    a numeric `value` field.
  - `toChartData(rows: Array<object>, xField: string, groupField: string|null, valueField = "value"): {data: Array<{x: string, [seriesName: string]: number}>, seriesNames: string[]}`

- [ ] **Step 1: Write `src/api/jsonStat.js`**

```js
export function flattenToRows(dataset) {
  const dims = dataset.id;
  const sizes = dataset.size;

  const dimensions = dims.map((code) => {
    const dim = dataset.dimension[code];
    const index = dim.category.index;
    const label = dim.category.label ?? {};
    const keys = index
      ? Object.entries(index)
          .sort((a, b) => a[1] - b[1])
          .map(([k]) => k)
      : Object.keys(label);
    return { code, keys, labels: label };
  });

  const total = dataset.value.length;
  const rows = [];

  for (let flatIndex = 0; flatIndex < total; flatIndex++) {
    let remainder = flatIndex;
    const coords = new Array(dims.length);
    for (let d = dims.length - 1; d >= 0; d--) {
      const size = sizes[d];
      coords[d] = remainder % size;
      remainder = Math.floor(remainder / size);
    }

    const row = {};
    dims.forEach((code, d) => {
      const dimension = dimensions[d];
      const key = dimension.keys[coords[d]];
      row[code] = key;
      row[`${code}_label`] = dimension.labels[key] ?? key;
    });
    row.value = dataset.value[flatIndex];
    rows.push(row);
  }

  return rows;
}

export function toChartData(rows, xField, groupField, valueField = "value") {
  const xOrder = [];
  const byX = new Map();
  const seriesNamesSeen = new Set();

  rows.forEach((row) => {
    const xLabel = row[`${xField}_label`] ?? row[xField];
    const seriesName = groupField
      ? row[`${groupField}_label`] ?? row[groupField]
      : "value";

    if (!byX.has(xLabel)) {
      byX.set(xLabel, { x: xLabel });
      xOrder.push(xLabel);
    }
    byX.get(xLabel)[seriesName] = row[valueField];
    seriesNamesSeen.add(seriesName);
  });

  return {
    data: xOrder.map((x) => byX.get(x)),
    seriesNames: Array.from(seriesNamesSeen),
  };
}
```

- [ ] **Step 2: Verify against a real captured json-stat2 fixture**

Run:
```bash
node -e "
import('./src/api/jsonStat.js').then((m) => {
  const dataset = {
    class: 'dataset',
    id: ['Vaatlusperiood', 'Näitaja'],
    size: [6, 3],
    dimension: {
      Vaatlusperiood: {
        label: 'Vaatlusperiood',
        category: {
          index: { '2025M11': 0, '2025M12': 1, '2026M01': 2, '2026M02': 3, '2026M03': 4, '2026M04': 5 },
          label: { '2025M11': '2025 november', '2025M12': '2025 detsember', '2026M01': '2026 jaanuar', '2026M02': '2026 veebruar', '2026M03': '2026 märts', '2026M04': '2026 aprill' }
        }
      },
      Näitaja: {
        label: 'Näitaja',
        category: {
          index: { OCC_ARR: 0, OCC_ARR_RES: 1, OCC_ARR_NONRES: 2 },
          label: { OCC_ARR: 'Majutatute arv', OCC_ARR_RES: 'Majutatud Eesti elanike arv', OCC_ARR_NONRES: 'Majutatud väliskülastajate arv' }
        }
      }
    },
    value: [254989,127716,127273,300216,138235,161981,217120,117629,99491,233291,120708,112583,234040,117238,116802,264204,124955,139249]
  };

  const rows = m.flattenToRows(dataset);
  console.log('rows:', rows.length);
  console.log('row0:', JSON.stringify(rows[0]));

  const chart = m.toChartData(rows, 'Vaatlusperiood', 'Näitaja');
  console.log('points:', chart.data.length);
  console.log('series:', chart.seriesNames.join(' | '));
  console.log('first point:', JSON.stringify(chart.data[0]));
});
"
```
Expected output:
```
rows: 18
row0: {"Vaatlusperiood":"2025M11","Vaatlusperiood_label":"2025 november","Näitaja":"OCC_ARR","Näitaja_label":"Majutatute arv","value":254989}
points: 6
series: Majutatute arv | Majutatud Eesti elanike arv | Majutatud väliskülastajate arv
first point: {"x":"2025 november","Majutatute arv":254989,"Majutatud Eesti elanike arv":127716,"Majutatud väliskülastajate arv":127273}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/jsonStat.js
git commit -m "feat: add json-stat2 parsing utilities"
```

---

### Task 4: Sidebar (folder/table tree)

**Files:**
- Create: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `fetchLevel` from `src/api/pxweb.js` (Task 2).
- Produces: `<Sidebar onSelectTable={(path: string[], tableId: string, title: string) => void} selectedTableId={string|null} />`

- [ ] **Step 1: Write `src/components/Sidebar.jsx`**

```jsx
import { useState } from "react";
import { fetchLevel } from "../api/pxweb";

const ROOT_PATH = ["majandus"];
const ROOT_ID = "turism-ja-majutus";
const ROOT_TEXT = "Turism, majutus ja toitlustus";

function FolderNode({ path, id, text, onSelectTable, selectedTableId }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fullPath = [...path, id];

  async function loadChildren() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchLevel(fullPath);
      setChildren(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (!expanded && children === null) {
      await loadChildren();
    }
    setExpanded((e) => !e);
  }

  return (
    <li>
      <button className="folder-toggle" onClick={toggle}>
        {expanded ? "▾" : "▸"} {text}
      </button>
      {loading && <div className="tree-status">Loading…</div>}
      {error && (
        <div className="tree-status tree-error">
          {error}{" "}
          <button onClick={loadChildren}>Retry</button>
        </div>
      )}
      {expanded && children && (
        <ul>
          {children.map((child) =>
            child.type === "l" ? (
              <FolderNode
                key={child.id}
                path={fullPath}
                id={child.id}
                text={child.text}
                onSelectTable={onSelectTable}
                selectedTableId={selectedTableId}
              />
            ) : (
              <li key={child.id}>
                <button
                  className={
                    "table-leaf" + (selectedTableId === child.id ? " selected" : "")
                  }
                  onClick={() => onSelectTable(fullPath, child.id, child.text)}
                >
                  {child.text}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </li>
  );
}

export default function Sidebar({ onSelectTable, selectedTableId }) {
  return (
    <nav className="sidebar">
      <ul>
        <FolderNode
          path={ROOT_PATH}
          id={ROOT_ID}
          text={ROOT_TEXT}
          onSelectTable={onSelectTable}
          selectedTableId={selectedTableId}
        />
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Wire it into `App.jsx` temporarily to verify in-browser**

Replace the contents of `src/App.jsx` (this will be replaced again in
Task 9, this is a temporary wiring just to see the Sidebar render):

```jsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        onSelectTable={(path, tableId, title) => setSelected({ path, tableId, title })}
        selectedTableId={selected?.tableId}
      />
      <pre>{JSON.stringify(selected, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev` and open the printed local URL (typically
`http://localhost:5173`).
Check:
1. A single top-level entry "▸ Turism, majutus ja toitlustus" is shown.
2. Clicking it expands to show 3 sub-folders: "Eesti elanike reisimine",
   "Majutus", "Turismi, majutuse ja toitlustuse majandusnäitajad".
3. Clicking "Majutus" expands to show ~13 tables (TU11, TU110, ... TU17).
4. Clicking a table (e.g. "TU121: MAJUTATUD (KUUD)") prints
   `{"path": ["majandus","turism-ja-majutus","majutus"], "tableId": "TU121.PX", "title": "TU121: MAJUTATUD (KUUD)"}`
   in the `<pre>` block, and the clicked item gets a `selected` class.

Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx
git commit -m "feat: add sidebar folder/table tree"
```

---

### Task 5: TableView + FilterBar (data fetching and filtering)

**Files:**
- Create: `src/components/FilterBar.jsx`
- Create: `src/components/TableView.jsx`

**Interfaces:**
- Consumes: `fetchTableMeta`, `fetchTableData` (Task 2); `flattenToRows`,
  `toChartData` (Task 3).
- Produces:
  - `<FilterBar variables={Array} query={Array} onChange={(query) => void} groupField={string|null} onGroupFieldChange={(field: string|null) => void} />`
  - `<TableView path={string[]} tableId={string} title={string} />` — the
    exact props `Sidebar`'s `onSelectTable` callback provides.
  - Internally computed `rows` (from `flattenToRows`) and `chartData`
    (from `toChartData`) are consumed by Tasks 6–8; this task renders
    them as raw JSON temporarily (replaced by real components in Tasks
    6–8).

- [ ] **Step 1: Write `src/components/FilterBar.jsx`**

```jsx
const TIME_TOP_OPTIONS = [6, 12, 24, 48, 120];

export default function FilterBar({
  variables,
  query,
  onChange,
  groupField,
  onGroupFieldChange,
}) {
  const timeVar = variables.find((v) => v.time);
  const nonTimeVars = variables.filter((v) => !v.time);

  function updateTimeTop(code, n) {
    onChange(
      query.map((q) =>
        q.code === code ? { ...q, selection: { filter: "top", values: [String(n)] } } : q
      )
    );
  }

  function updateVariable(code, values) {
    onChange(
      query.map((q) =>
        q.code === code ? { ...q, selection: { filter: "item", values } } : q
      )
    );
  }

  return (
    <div className="filter-bar">
      {timeVar && (
        <label>
          {timeVar.text}:{" "}
          <select
            defaultValue="24"
            onChange={(e) => updateTimeTop(timeVar.code, e.target.value)}
          >
            {TIME_TOP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                last {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {nonTimeVars.map((v) => (
        <label key={v.code}>
          {v.text}:{" "}
          <select
            multiple
            value={query.find((q) => q.code === v.code)?.selection.values ?? []}
            onChange={(e) =>
              updateVariable(
                v.code,
                Array.from(e.target.selectedOptions, (o) => o.value)
              )
            }
          >
            {v.values.map((val, i) => (
              <option key={val} value={val}>
                {v.valueTexts[i]}
              </option>
            ))}
          </select>
        </label>
      ))}
      {nonTimeVars.length > 0 && (
        <label>
          Group chart by:{" "}
          <select
            value={groupField ?? ""}
            onChange={(e) => onGroupFieldChange(e.target.value || null)}
          >
            <option value="">(none)</option>
            {nonTimeVars.map((v) => (
              <option key={v.code} value={v.code}>
                {v.text}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/TableView.jsx`**

```jsx
import { useEffect, useMemo, useState } from "react";
import { fetchTableMeta, fetchTableData } from "../api/pxweb";
import { flattenToRows, toChartData } from "../api/jsonStat";
import FilterBar from "./FilterBar";

function defaultQuery(variables) {
  return variables.map((v) => {
    if (v.time) {
      return { code: v.code, selection: { filter: "top", values: ["24"] } };
    }
    if (v.elimination) {
      return { code: v.code, selection: { filter: "item", values: [v.values[0]] } };
    }
    return { code: v.code, selection: { filter: "item", values: v.values } };
  });
}

export default function TableView({ path, tableId, title }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [query, setQuery] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [dataError, setDataError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupField, setGroupField] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setMetaError(null);
    setDataset(null);
    setQuery(null);

    fetchTableMeta(path, tableId)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setQuery(defaultQuery(m.variables));
        const firstNonTime = m.variables.find((v) => !v.time);
        setGroupField(firstNonTime ? firstNonTime.code : null);
      })
      .catch((err) => !cancelled && setMetaError(err.message));

    return () => {
      cancelled = true;
    };
  }, [path, tableId]);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setLoading(true);
    setDataError(null);

    fetchTableData(path, tableId, query)
      .then((d) => !cancelled && setDataset(d))
      .catch((err) => !cancelled && setDataError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [path, tableId, query]);

  const rows = useMemo(() => (dataset ? flattenToRows(dataset) : []), [dataset]);
  const timeField = meta?.variables.find((v) => v.time)?.code ?? null;
  const chartData = useMemo(() => {
    if (!rows.length || !timeField) return { data: [], seriesNames: [] };
    return toChartData(rows, timeField, groupField);
  }, [rows, timeField, groupField]);

  if (metaError) {
    return <div className="panel-error">Failed to load table: {metaError}</div>;
  }
  if (!meta || !query) {
    return <div className="panel-status">Loading table…</div>;
  }

  return (
    <div className="table-view">
      <h2>{title}</h2>
      <FilterBar
        variables={meta.variables}
        query={query}
        onChange={setQuery}
        groupField={groupField}
        onGroupFieldChange={setGroupField}
      />
      {dataError && (
        <div className="panel-error">
          Failed to load data: {dataError}{" "}
          <button onClick={() => setQuery([...query])}>Retry</button>
        </div>
      )}
      {loading && <div className="panel-status">Loading data…</div>}
      {!loading && !dataError && (
        <pre>{JSON.stringify({ rowCount: rows.length, chartData }, null, 2)}</pre>
      )}
    </div>
  );
}
```

(The final `<pre>` block is a temporary stand-in for `ChartPanel`,
`DataGrid`, and `ExportButtons`, wired in Tasks 6–8.)

- [ ] **Step 3: Wire `TableView` into `App.jsx` temporarily**

```jsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";

export default function App() {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        onSelectTable={(path, tableId, title) => setSelected({ path, tableId, title })}
        selectedTableId={selected?.tableId}
      />
      <main style={{ flex: 1, padding: 16 }}>
        {selected ? (
          <TableView path={selected.path} tableId={selected.tableId} title={selected.title} />
        ) : (
          <div>Select a table from the sidebar to begin.</div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open the local URL, expand Majutus, click "TU121:
MAJUTATUD (KUUD)".
Check:
1. Title "TU121: MAJUTATUD (KUUD)" appears.
2. A "Vaatlusperiood" dropdown showing "last 24" and a "Näitaja"
   multi-select with 3 options appear.
3. Below, a JSON block appears showing `rowCount: 72` (24 periods × 3
   indicators) and a `chartData.data` array with 24 points.
4. Changing the Vaatlusperiood dropdown to "last 6" updates `rowCount` to
   18 within a second or two (confirms refetch on filter change).
5. Deselecting one of the 3 Näitaja options and confirming the query
   updates (row count drops proportionally) — note the multi-select
   needs ctrl/cmd-click to toggle individual options.

Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/components/FilterBar.jsx src/components/TableView.jsx src/App.jsx
git commit -m "feat: add TableView data fetching and FilterBar"
```

---

### Task 6: DataGrid (sortable datasheet)

**Files:**
- Create: `src/components/DataGrid.jsx`
- Modify: `src/components/TableView.jsx` — replace the temporary `<pre>`
  row-count block with `<DataGrid rows={rows} />`.

**Interfaces:**
- Consumes: `rows` produced by `flattenToRows` (Task 3), already computed
  in `TableView` (Task 5).
- Produces: `<DataGrid rows={Array<Record<string, string|number>>} />`

- [ ] **Step 1: Write `src/components/DataGrid.jsx`**

```jsx
import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";

export default function DataGrid({ rows }) {
  const [sorting, setSorting] = useState([]);

  const columns = useMemo(() => {
    if (!rows.length) return [];
    const labelKeys = Object.keys(rows[0]).filter((k) => k.endsWith("_label"));
    return [
      ...labelKeys.map((key) => ({
        accessorKey: key,
        header: key.replace(/_label$/, ""),
      })),
      { accessorKey: "value", header: "Value" },
    ];
  }, [rows]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!rows.length) return <div className="panel-status">No data.</div>;

  return (
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
  );
}
```

- [ ] **Step 2: Wire it into `TableView.jsx`**

In `src/components/TableView.jsx`, add the import:

```jsx
import DataGrid from "./DataGrid";
```

Replace:

```jsx
      {!loading && !dataError && (
        <pre>{JSON.stringify({ rowCount: rows.length, chartData }, null, 2)}</pre>
      )}
```

with:

```jsx
      {!loading && !dataError && (
        <>
          <pre>{JSON.stringify({ chartData }, null, 2)}</pre>
          <DataGrid rows={rows} />
        </>
      )}
```

(The `chartData` `<pre>` stays as a stand-in until Task 7 replaces it
with `ChartPanel`.)

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, select "TU121: MAJUTATUD (KUUD)".
Check:
1. A table appears below the JSON block with columns "Vaatlusperiood",
   "Näitaja", "Value" and 72 rows (last 24 periods × 3 indicators).
2. Clicking the "Value" column header sorts rows ascending (▲ appears);
   clicking again sorts descending (▼ appears).
3. Switching to "last 6" in the filter updates the grid to 18 rows.

Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/components/DataGrid.jsx src/components/TableView.jsx
git commit -m "feat: add sortable data grid"
```

---

### Task 7: ChartPanel (line/bar chart)

**Files:**
- Create: `src/components/ChartPanel.jsx`
- Modify: `src/components/TableView.jsx` — replace the temporary
  `chartData` `<pre>` block with `<ChartPanel />`, and add `chartType`
  state.

**Interfaces:**
- Consumes: `chartData.data` / `chartData.seriesNames` from `toChartData`
  (Task 3), already computed in `TableView` (Task 5).
- Produces: `<ChartPanel data={Array} seriesNames={string[]} chartType={"line"|"bar"} onChartTypeChange={(type) => void} />`
  Renders into a container with `id="chart-panel-root"` so Task 8's PNG
  export can find the `<svg>` inside it.

- [ ] **Step 1: Write `src/components/ChartPanel.jsx`**

```jsx
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export default function ChartPanel({ data, seriesNames, chartType, onChartTypeChange }) {
  if (!data.length) return <div className="panel-status">No data to chart.</div>;

  const Chart = chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="chart-panel" id="chart-panel-root">
      <div className="chart-toggle">
        <button
          className={chartType === "line" ? "active" : ""}
          onClick={() => onChartTypeChange("line")}
        >
          Line
        </button>
        <button
          className={chartType === "bar" ? "active" : ""}
          onClick={() => onChartTypeChange("bar")}
        >
          Bar
        </button>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Legend />
          {seriesNames.map((name, i) =>
            chartType === "bar" ? (
              <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} />
            ) : (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `TableView.jsx`**

Add the import and a `chartType` state:

```jsx
import ChartPanel from "./ChartPanel";
```

Add alongside the other `useState` calls:

```jsx
  const [chartType, setChartType] = useState("line");
```

Replace:

```jsx
        <>
          <pre>{JSON.stringify({ chartData }, null, 2)}</pre>
          <DataGrid rows={rows} />
        </>
```

with:

```jsx
        <>
          <ChartPanel
            data={chartData.data}
            seriesNames={chartData.seriesNames}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <DataGrid rows={rows} />
        </>
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, select "TU121: MAJUTATUD (KUUD)".
Check:
1. A line chart renders with 3 series (one per Näitaja value) over the
   last 24 periods, with a legend showing all 3 series names.
2. Clicking "Bar" switches to a grouped bar chart of the same data;
   clicking "Line" switches back.
3. Selecting "Turismi, majutuse ja toitlustuse majandusnäitajad" →
   any table, or "Eesti elanike reisimine" → any table, also renders a
   chart without errors (confirms the generic parsing/grouping works
   outside the Majutus subfolder).

Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChartPanel.jsx src/components/TableView.jsx
git commit -m "feat: add line/bar chart panel"
```

---

### Task 8: ExportButtons (CSV/XLSX/PNG)

**Files:**
- Create: `src/components/ExportButtons.jsx`
- Modify: `src/components/TableView.jsx` — render `<ExportButtons
  rows={rows} tableId={tableId} />` above `<DataGrid>`.

**Interfaces:**
- Consumes: `rows` (Task 3/5), `tableId` (prop already available in
  `TableView`), and the `#chart-panel-root svg` element rendered by
  `ChartPanel` (Task 7).
- Produces: `<ExportButtons rows={Array} tableId={string} />`

- [ ] **Step 1: Write `src/components/ExportButtons.jsx`**

```jsx
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
```

- [ ] **Step 2: Wire it into `TableView.jsx`**

Add the import:

```jsx
import ExportButtons from "./ExportButtons";
```

Replace:

```jsx
        <>
          <ChartPanel
            data={chartData.data}
            seriesNames={chartData.seriesNames}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <DataGrid rows={rows} />
        </>
```

with:

```jsx
        <>
          <ChartPanel
            data={chartData.data}
            seriesNames={chartData.seriesNames}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <ExportButtons rows={rows} tableId={tableId} />
          <DataGrid rows={rows} />
        </>
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, select "TU121: MAJUTATUD (KUUD)".
Check:
1. Clicking "Export CSV" downloads a `TU121.PX.csv` file; open it and
   confirm it has columns Vaatlusperiood, Näitaja, Value with 72 data
   rows.
2. Clicking "Export XLSX" downloads `TU121.PX.xlsx`; open it in a
   spreadsheet app and confirm the same columns/rows appear on a sheet
   named `TU121.PX`.
3. Clicking "Export PNG" downloads `TU121.PX-chart.png`; open it and
   confirm it's a rendered image of the currently visible chart (matches
   whichever of line/bar is selected).

Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/components/ExportButtons.jsx src/components/TableView.jsx
git commit -m "feat: add CSV/XLSX/PNG export"
```

---

### Task 9: Final app wiring, styling, and full manual verification

**Files:**
- Modify: `src/App.jsx` — replace the temporary inline version from
  Tasks 4/5 with the final version (adds a status message when nothing
  is selected, matches the spec's component list).
- Modify: `src/App.css` — replace the placeholder with real layout and
  component styling.

**Interfaces:**
- Consumes: `Sidebar` (Task 4), `TableView` (Task 5, now composing
  `FilterBar`, `DataGrid`, `ChartPanel`, `ExportButtons` from Tasks 5–8).
- Produces: the complete app entry point — no further tasks depend on
  this one.

- [ ] **Step 1: Write the final `src/App.jsx`**

```jsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import "./App.css";

export default function App() {
  const [selected, setSelected] = useState(null);

  function handleSelectTable(path, tableId, title) {
    setSelected({ path, tableId, title });
  }

  return (
    <div className="app-shell">
      <Sidebar onSelectTable={handleSelectTable} selectedTableId={selected?.tableId} />
      <main className="main-panel">
        {selected ? (
          <TableView path={selected.path} tableId={selected.tableId} title={selected.title} />
        ) : (
          <div className="panel-status">Select a table from the sidebar to begin.</div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write the final `src/App.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  padding: 12px;
  overflow-y: auto;
  max-height: 100vh;
}

.sidebar ul {
  list-style: none;
  margin: 0;
  padding-left: 12px;
}

.sidebar > ul {
  padding-left: 0;
}

.folder-toggle,
.table-leaf {
  background: none;
  border: none;
  text-align: left;
  padding: 4px 6px;
  width: 100%;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
}

.folder-toggle:hover,
.table-leaf:hover {
  background: #f3f4f6;
}

.table-leaf.selected {
  background: #dbeafe;
  font-weight: 600;
}

.tree-status {
  padding: 2px 6px;
  font-size: 12px;
  color: #6b7280;
}

.tree-error {
  color: #b91c1c;
}

.main-panel {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  max-height: 100vh;
}

.panel-status {
  color: #6b7280;
}

.panel-error {
  color: #b91c1c;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 12px 0;
}

.filter-bar label {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 4px;
}

.chart-panel {
  margin: 16px 0;
}

.chart-toggle button {
  margin-right: 8px;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}

.chart-toggle button.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.export-buttons {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.export-buttons button {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  border-radius: 4px;
  cursor: pointer;
}

.data-grid {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.data-grid th,
.data-grid td {
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  text-align: left;
}

.data-grid th {
  background: #f9fafb;
  cursor: pointer;
}
```

- [ ] **Step 3: Full manual verification pass**

Run: `npm run dev`, open the local URL. Walk through the spec's own
testing checklist:

1. Expand all 3 subfolders under "Turism, majutus ja toitlustus":
   "Eesti elanike reisimine", "Majutus", "Turismi, majutuse ja
   toitlustuse majandusnäitajad" — confirm each lists at least one table.
2. Open TU121 (Majutus) — confirm filters, chart (line + bar toggle),
   grid, and all 3 exports work (as verified in Tasks 5–8).
3. Open TU11 (Majutus, "MAJUTUSKOHTADE MAHUTAVUS PIIRKONNA JÄRGI") —
   confirm it loads without errors (this table has a region dimension
   rather than a monthly one, exercising a different variable shape).
4. Open one table from "Eesti elanike reisimine" and one from "Turismi,
   majutuse ja toitlustuse majandusnäitajad" — confirm both load,
   chart, grid, and export without errors.
5. Trigger an error state deliberately: with dev tools open, throttle
   network to "Offline" briefly while switching tables, confirm the
   inline error + "Retry" button appears, then restore the network and
   click "Retry" to confirm it recovers.

Stop the dev server after confirming.

- [ ] **Step 4: Verify the production build still succeeds end-to-end**

Run: `npm run build`
Expected: exits 0. Optionally run `npm run preview` and repeat a quick
spot-check (open TU121, confirm chart/grid render) against the built
output.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "feat: finalize app shell and styling"
```
