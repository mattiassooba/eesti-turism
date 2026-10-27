import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../state/AppState.jsx";
import { useTourism, useCapacity } from "../../data/datasets.js";
import { lastCompleteYear } from "../../data/metrics.js";
import { buildPacket } from "../../data/askPacket.js";
import { ASK_AI_ENABLED, askAi } from "../../data/askClient.js";
import { regionName } from "../../lib/regions.js";
import { etLocative } from "../../pages/home/headlines.js";
import { MAX_QUESTION, MIN_QUESTION } from "@prod/lib/askShape.js";
import Icon from "../ui/Icon.jsx";

// "Küsi AI-lt": a button in the AI summary card that opens a side panel
// (bottom sheet on phones) where visitors ask about the data. Numbers come
// from buildPacket; the Worker only has the model word them. Renders
// nothing unless VITE_ASK_AI_URL is set at build time.
export default function AskAi() {
  if (!ASK_AI_ENABLED) return null;
  return <AskAiControl />;
}

// Estonian "in X" for suggestions: the everyday "Hiiumaal" for counties.
function etIn(region) {
  return region.kind === "county" ? `${region.shortEt}maal` : etLocative(region.et);
}

function useSuggestions(tourism) {
  const { t, locale, region } = useApp();
  if (!tourism) return [];
  const to = lastCompleteYear(tourism.periods, tourism.get("OCC_ARR", "EE"));
  if (!to) return [];
  const from = to - 9;
  if (region.kind === "country") return t("ask.suggest.country", [from, to]);
  return t("ask.suggest.region", [locale === "et" ? etIn(region) : regionName(region, "en"), from, to]);
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function AskAiControl() {
  const { t, locale, region, compare } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const pending = useRef(null);
  const requestId = useRef(0);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const titleId = useId();
  const inputId = useId();
  const suggestions = useSuggestions(tourism.data);
  const loading = phase === "loading";

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
  }, []);

  // Esc is handled on the document: while an answer loads the input is
  // disabled, which drops focus to <body>, outside the panel.
  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Give focus back to the question box once an answer (or error) arrives.
  useEffect(() => {
    if (open && phase !== "loading" && phase !== "idle" && !panelRef.current?.contains(document.activeElement)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [open, phase]);

  // Sends the question once both datasets are loaded; until then the panel
  // shows the loading state.
  useEffect(() => {
    const q = pending.current;
    if (!q) return;
    if (tourism.error || capacity.error) {
      pending.current = null;
      setPhase("error");
      return;
    }
    if (!tourism.data || !capacity.data) return;
    pending.current = null;
    const id = ++requestId.current;
    const packet = buildPacket({ tourism: tourism.data, capacity: capacity.data, locale, question: q });
    askAi({ question: q, locale, selected: { region: region.id, compare: compare?.id ?? null }, packet }).then((res) => {
      if (id !== requestId.current) return;
      setResult(res);
      setPhase(res.status);
    });
  }, [asked, phase, tourism.data, tourism.error, capacity.data, capacity.error, locale, region.id, compare?.id]);

  function submit(text) {
    const q = text.trim().replace(/\s+/g, " ");
    if (loading || q.length < MIN_QUESTION) return;
    pending.current = q;
    setAsked(q);
    setPhase("loading");
  }

  function onKeyDown(e) {
    if (e.key !== "Tab") return;
    const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button ref={buttonRef} type="button" className="ask-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <Icon name="ai" size={16} />
        {t("ask.button")}
      </button>
      {open &&
        createPortal(
          <div className="ask-layer" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <section ref={panelRef} className="ask-panel" data-theme="dark" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
              <header className="ask-head">
                <div>
                  <h2 id={titleId} className="ask-title">
                    <Icon name="ai" size={22} />
                    {t("ask.title")}
                  </h2>
                  <p className="ask-sub">{t("ask.subtitle")}</p>
                </div>
                <button type="button" className="icon-btn ask-close" onClick={close} aria-label={t("ask.close")}>
                  <Icon name="close" />
                </button>
              </header>

              <form
                className="ask-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(question);
                }}
              >
                <label className="sr-only" htmlFor={inputId}>
                  {t("ask.label")}
                </label>
                <div className="ask-input">
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    value={question}
                    maxLength={MAX_QUESTION}
                    placeholder={t("ask.placeholder")}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                  />
                  <button type="submit" className="ask-send" disabled={loading || question.trim().length < MIN_QUESTION} aria-label={t("ask.submit")}>
                    <Icon name="arrowRight" size={18} />
                  </button>
                </div>
              </form>

              {suggestions.length > 0 && (
                <div className="ask-suggest">
                  <p className="ask-suggest-label t-meta">{t("ask.suggestedLabel")}</p>
                  <div className="ask-chips">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="ask-chip"
                        disabled={loading}
                        onClick={() => {
                          setQuestion(s);
                          submit(s);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="ask-body" aria-live="polite" aria-busy={loading}>
                {phase !== "idle" && <p className="ask-asked">“{asked}”</p>}
                {phase === "idle" && <p className="ask-scope">{t("ask.scope")}</p>}
                {loading && (
                  <div className="skeleton-lines ask-skeleton">
                    <span className="sr-only">{t("ask.loading")}</span>
                    <span />
                    <span />
                    <span style={{ width: "62%" }} />
                  </div>
                )}
                {phase === "answer" && (
                  <article className={"ask-result" + (result.unavailable ? " ask-result--unavailable" : "")}>
                    {result.unavailable && <p className="ask-result-label">{t("ask.unavailableLabel")}</p>}
                    <p className="ask-result-text">{result.answer}</p>
                    {result.evidence.length > 0 && (
                      <>
                        <p className="ask-result-label">{t("ask.evidenceLabel")}</p>
                        <ul className="ask-evidence">
                          {result.evidence.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {result.note && <p className="ask-note">{result.note}</p>}
                    <p className="ask-foot t-meta">{t("ask.footer", [result.source, result.period])}</p>
                  </article>
                )}
                {phase === "limit" && <p className="ask-notice">{result.reason === "daily" ? t("ask.limitDaily") : t("ask.limitVisitor")}</p>}
                {phase === "error" && (
                  <div className="ask-notice ask-notice--error">
                    <p>{t("ask.error")}</p>
                    <button type="button" className="btn btn--light" onClick={() => submit(asked)}>
                      {t("ask.retry")}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
