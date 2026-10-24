import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import { ESTONIA, COUNTY_LIST, CITY_LIST, regionName } from "../../lib/regions.js";
import Icon from "../ui/Icon.jsx";
import LocatorMap from "../map/LocatorMap.jsx";

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// The single global region control. Opens as an anchored panel on wide
// screens and as a bottom sheet on phones; the choice is written to ?r=.
export function RegionPanel({ value, onSelect, onClose, title, allowNone = false, noneLabel, exclude }) {
  const { t, locale } = useApp();
  const [term, setTerm] = useState("");
  const inputRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const groups = useMemo(() => {
    const match = (r) => !term || normalize(regionName(r, locale)).includes(normalize(term));
    const notExcluded = (r) => r.code !== exclude;
    return [
      { key: "country", label: t("region.groupCountry"), items: [ESTONIA].filter(match).filter(notExcluded) },
      { key: "county", label: t("region.groupCounties"), items: COUNTY_LIST.filter(match).filter(notExcluded) },
      { key: "city", label: t("region.groupCities"), items: CITY_LIST.filter(match).filter(notExcluded) },
    ].filter((g) => g.items.length);
  }, [term, locale, t, exclude]);

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
    }
  }

  return (
    <div className="region-panel" role="dialog" aria-label={title} onKeyDown={onKeyDown}>
      <div className="region-panel-head">
        <p className="region-panel-title">{title}</p>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="close" />
        </button>
      </div>
      <label className="region-search">
        <Icon name="search" size={16} />
        <span className="sr-only">{t("region.search")}</span>
        <input
          ref={inputRef}
          type="search"
          value={term}
          placeholder={t("region.search")}
          onChange={(e) => setTerm(e.target.value)}
          aria-controls={listId}
        />
      </label>
      <div className="region-panel-body" id={listId}>
        {allowNone && !term && (
          <button type="button" className={"region-option region-option--none" + (!value ? " is-active" : "")} onClick={() => onSelect(null)}>
            <span>{noneLabel}</span>
            {!value && <Icon name="check" size={16} />}
          </button>
        )}
        {groups.map((g) => (
          <div key={g.key} className={`region-group region-group--${g.key}`}>
            <p className="region-group-label">{g.label}</p>
            <div className="region-group-items">
              {g.items.map((r) => {
                const active = value === r.code;
                return (
                  <button
                    key={r.code}
                    type="button"
                    className={"region-option" + (active ? " is-active" : "")}
                    aria-pressed={active}
                    onClick={() => onSelect(r)}
                  >
                    <span>{regionName(r, locale, { short: r.kind === "county" })}</span>
                    {active && <Icon name="check" size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!groups.length && <p className="region-empty">{t("region.noMatch")}</p>}
      </div>
      <p className="region-panel-foot t-meta">{t("region.footNote")}</p>
    </div>
  );
}

export default function RegionPicker({ variant = "header" }) {
  const { t, locale, region, setRegion } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  function close() {
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <div className={`region-picker region-picker--${variant}`} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="region-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <LocatorMap code={region.code} className="region-trigger-map" />
        <span className="region-trigger-text">
          <span className="region-trigger-label">{t("region.label")}</span>
          <span className="region-trigger-value">{regionName(region, locale, { short: region.kind === "county" })}</span>
        </span>
        <Icon name="chevronDown" size={16} className="region-trigger-chev" />
      </button>
      {open && (
        <>
          <div className="sheet-backdrop" aria-hidden="true" onClick={close} />
          <RegionPanel
            value={region.code}
            title={t("region.choose")}
            onClose={close}
            onSelect={(r) => {
              setRegion(r.id);
              close();
            }}
          />
        </>
      )}
    </div>
  );
}
