import { useEffect, useState } from "react";
import { useApp } from "../../state/AppState.jsx";

const GROUPS = {
  depth: ["--abyss", "--deep", "--navy-900", "--navy-800", "--navy-700", "--navy-600"],
  shore: ["--surface", "--paper", "--mist", "--frost", "--line", "--line-2"],
  text: ["--ink", "--ink-2", "--ink-3", "--on-dark", "--on-dark-2", "--on-dark-3"],
  accent: ["--baltic", "--baltic-ink", "--baltic-strong", "--sea", "--sea-200", "--sea-100", "--teal", "--amber", "--amber-ink"],
  status: ["--pos", "--pos-bg", "--neg", "--neg-bg", "--pos-on-dark", "--neg-on-dark"],
  data: ["--c-domestic", "--c-foreign", "--c-1", "--c-2", "--c-3", "--c-4", "--c-5", "--c-6", "--c-muted", "--c-region", "--c-compare"],
};

function rgb(hex) {
  const h = hex.replace("#", "").trim();
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function useTokens() {
  const [values, setValues] = useState({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const name of Object.values(GROUPS).flat()) out[name] = cs.getPropertyValue(name).trim();
    out["--white"] = "#ffffff";
    setValues(out);
  }, []);
  return values;
}

function Ratio({ value }) {
  const { t, locale } = useApp();
  const level = value >= 4.5 ? "aa" : value >= 3 ? "aaLarge" : "fail";
  return (
    <span className={`ratio ratio--${level}`} title={t(`studio.palette.${level}`)}>
      {value.toLocaleString(locale === "et" ? "et-EE" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}:1
    </span>
  );
}

export function Palette() {
  const { t } = useApp();
  const tokens = useTokens();
  const dark = tokens["--navy-900"];
  if (!dark) return null;
  return (
    <div className="palette">
      <p className="palette-legend t-meta">
        {t("studio.palette.legend")}{" "}
        <span className="ratio ratio--aa">{t("studio.palette.aa")}</span> <span className="ratio ratio--aaLarge">{t("studio.palette.aaLarge")}</span>{" "}
        <span className="ratio ratio--fail">{t("studio.palette.fail")}</span>
      </p>
      {Object.entries(GROUPS).map(([g, names]) => (
        <section key={g} className="palette-group" aria-labelledby={`pal-${g}`}>
          <h3 id={`pal-${g}`} className="block-label">
            {t(`studio.palette.groups.${g}`)}
          </h3>
          <ul className="swatches">
            {names.map((name) => {
              const hex = tokens[name];
              if (!/^#[0-9a-f]{3,6}$/i.test(hex)) return null;
              return (
                <li key={name} className="swatch">
                  <span className="swatch-chip" style={{ background: hex }} />
                  <span className="swatch-name">{name.slice(2)}</span>
                  <span className="swatch-hex">{hex.toUpperCase()}</span>
                  <span className="swatch-ratios">
                    <span>
                      {t("studio.palette.vsWhite")} <Ratio value={contrast(hex, "#ffffff")} />
                    </span>
                    <span>
                      {t("studio.palette.vsDark")} <Ratio value={contrast(hex, dark)} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {g === "data" && <p className="palette-note t-meta">{t("studio.palette.dataNote")}</p>}
        </section>
      ))}
    </div>
  );
}

const SCALE = [
  { token: "--fs-hero", cls: "t-hero", label: "Hero" },
  { token: "--fs-h1", cls: "t-h1", label: "H1" },
  { token: "--fs-h2", cls: "t-h2", label: "H2" },
  { token: "--fs-h3", cls: "t-h3", label: "H3" },
  { token: "--fs-lead", cls: "t-lead", label: "Lead" },
  { token: "--fs-body", cls: "t-body", label: "Body" },
  { token: "--fs-meta", cls: "t-meta", label: "Meta" },
];

export function Typography() {
  const { t } = useApp();
  const families = [
    { key: "display", font: "var(--font-display)", weight: 650 },
    { key: "ui", font: "var(--font-ui)", weight: 450 },
    { key: "mono", font: "var(--font-mono)", weight: 450 },
  ];
  return (
    <div className="typespec">
      <div className="type-families">
        {families.map((f) => (
          <article key={f.key} className="type-family">
            <p className="block-label">{t(`studio.type.${f.key}`)}</p>
            <p className="type-glyphs" style={{ fontFamily: f.font, fontWeight: f.weight }}>
              Aa Õõ Ää Öö Üü Šš Žž
            </p>
            <p className="type-pangram" style={{ fontFamily: f.font }}>
              {t("studio.type.pangram")}
            </p>
            <p className="type-numerals" style={{ fontFamily: f.font }}>
              0123456789 · 12 345,6 · −4,9% · €
            </p>
            <p className="type-use">{t(`studio.type.${f.key}Use`)}</p>
          </article>
        ))}
      </div>
      <h3 className="block-label type-scale-title">{t("studio.type.scale")}</h3>
      <ol className="type-scale">
        {SCALE.map((s) => (
          <li key={s.token}>
            <span className="type-scale-meta t-meta">
              {s.label}
              <br />
              {s.token}
            </span>
            <span className={`type-scale-sample ${s.cls}`}>{t("studio.type.sample")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
