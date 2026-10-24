import { useEffect, useRef, useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import { regionName } from "../../lib/regions.js";
import Icon from "../ui/Icon.jsx";
import { RegionPanel } from "./RegionPicker.jsx";

// Picks the comparison region (?vs=). "None" clears it; the primary
// region is excluded from the list.
export default function CompareControl({ value, onChange, exclude, label }) {
  const { t, locale } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="compare-control region-picker" ref={wrapRef}>
      <button ref={btnRef} type="button" className="compare-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        <span className="compare-swatch" aria-hidden="true" />
        <span className="region-trigger-text">
          <span className="region-trigger-label">{label ?? t("compare.label")}</span>
          <span className="region-trigger-value">{value ? regionName(value, locale, { short: value.kind === "county" }) : t("compare.none")}</span>
        </span>
        <Icon name="chevronDown" size={16} className="region-trigger-chev" />
      </button>
      {open && (
        <>
          <div className="sheet-backdrop" aria-hidden="true" onClick={close} />
          <RegionPanel
            value={value?.code ?? null}
            title={t("compare.choose")}
            allowNone
            noneLabel={t("compare.none")}
            exclude={exclude}
            onClose={close}
            onSelect={(r) => {
              onChange(r);
              close();
            }}
          />
        </>
      )}
    </div>
  );
}
