import { useEffect, useState } from "react";

// Tracks which of `sectionIds` currently occupies the "reading position" of
// the scroll container, so the matching nav tab can stay highlighted while
// the user scrolls through one continuous page instead of clicking between
// tabs. `containerRef` is normally the actual scrolling element (this app
// scrolls inside .main-panel, not the document body) — except below the
// 720px responsive breakpoint, where .main-panel's own max-height is
// dropped and the window scrolls instead. IntersectionObserver requires a
// root with real scrollable overflow, so detect which applies.
export function useActiveSection(sectionIds, containerRef, enabled) {
  const [activeId, setActiveId] = useState(sectionIds[0]);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    function setUp() {
      const elements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
      if (!elements.length) return null;

      const containerScrolls = container.scrollHeight > container.clientHeight;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible.length) setActiveId(visible[0].target.id);
        },
        {
          root: containerScrolls ? container : null,
          // A section counts as "current" once it reaches the upper band
          // of the scrolling viewport, not merely as soon as its edge
          // appears.
          rootMargin: "-10% 0px -70% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );
      elements.forEach((el) => observer.observe(el));
      return observer;
    }

    let observer = setUp();

    // Whether .main-panel or the window scrolls depends on the responsive
    // breakpoint — re-detect on resize (e.g. rotating a tablet, or
    // resizing a desktop window past 720px) rather than only once on
    // mount.
    const handleResize = () => {
      observer?.disconnect();
      observer = setUp();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [sectionIds, containerRef, enabled]);

  return activeId;
}
