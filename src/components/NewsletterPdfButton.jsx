import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { loadNarrative } from "../data/narrative";

const SECTION_ORDER = ["dashboard", "map", "purpose", "capacity", "expenses"];
const SECTION_NAV_KEY = {
  dashboard: "nav.dashboard",
  map: "nav.map",
  purpose: "nav.purpose",
  capacity: "nav.capacity",
  expenses: "nav.expenses",
};

const MARGIN = 48;
const LINE_HEIGHT = 14;

// Only enabled once narrative.json is confirmed present — same
// graceful-degradation stance as NarrativeBlock (no error UI, just no
// button, before the first scheduled generation has ever run).
export default function NewsletterPdfButton() {
  const { t, locale } = useTranslation();
  const [narrative, setNarrative] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadNarrative().then((data) => {
      if (!cancelled && data?.sections) setNarrative(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!narrative) return null;

  async function download() {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - MARGIN * 2;
      let y = MARGIN;

      function ensureSpace(needed) {
        if (y + needed > pageHeight - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
      }

      function paragraph(text, { font = "normal", size = 10.5, gap = 10, color = 0 } = {}) {
        doc.setFont("helvetica", font);
        doc.setFontSize(size);
        doc.setTextColor(color);
        const lines = doc.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT);
          doc.text(line, MARGIN, y);
          y += LINE_HEIGHT;
        }
        doc.setTextColor(0);
        y += gap;
      }

      const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;

      paragraph(`${t("app.brand")} — ${periodLabel}`, { font: "bold", size: 20, gap: 4 });
      paragraph(t("newsletterPdf.intro"), { font: "italic", size: 9, color: 110, gap: 18 });

      for (const key of SECTION_ORDER) {
        const section = narrative.sections[key];
        if (!section) continue;
        ensureSpace(LINE_HEIGHT * 2);
        paragraph(t(SECTION_NAV_KEY[key]), { font: "bold", size: 13, gap: 6 });
        paragraph(section[locale] ?? section.et, { gap: 16 });
      }

      const generatedDate = new Date(narrative.generatedAt).toLocaleDateString(
        locale === "en" ? "en-US" : "et-EE"
      );
      paragraph(`${t("newsletterPdf.generatedOn")} ${generatedDate} · turismistatistika.ee`, {
        font: "italic",
        size: 8.5,
        color: 110,
        gap: 0,
      });

      doc.save(`eesti-turism-${narrative.period}-${locale}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button type="button" className="newsletter-pdf-button" onClick={download} disabled={generating}>
      {generating ? t("newsletterPdf.generating") : t("newsletterPdf.download")}
    </button>
  );
}
