import { useEffect, useRef, useState } from "react";

// Delays mounting `children` until this wrapper scrolls near the given
// scroll container's viewport. Without this, stacking every section on one
// continuously-scrolling page would fire all of their data fetches at once
// on load, instead of only the sections the user actually scrolls to. Once
// shown, a section stays mounted — scrolling back up shouldn't unmount it
// and lose its fetched data.
export default function LazyMount({ children, containerRef, rootMargin = "600px 0px" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    const root = containerRef.current;
    if (!el || !root) return;

    let intersecting = false;
    let settleTimer = null;

    function scheduleCheck() {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (intersecting) {
          setVisible(true);
          cleanup();
        }
      }, 600);
    }

    // Below the 720px responsive breakpoint, .main-panel's max-height is
    // dropped and the window scrolls instead — IntersectionObserver needs
    // a root with real scrollable overflow, so fall back to the window
    // (root: null) when .main-panel itself has none.
    const rootScrolls = root.scrollHeight > root.clientHeight;
    const io = new IntersectionObserver(
      (entries) => {
        intersecting = entries[0].isIntersecting;
        scheduleCheck();
      },
      { root: rootScrolls ? root : null, rootMargin }
    );
    io.observe(el);

    // An earlier section can still be short (its own async data hasn't
    // rendered yet, e.g. the dashboard before its fetch resolves), making
    // this section look closer to the viewport than it will end up once
    // that content finishes loading and pushes it further down. .main-panel
    // itself has a fixed height (it's the scroll container), so watch the
    // section stack's actual content height instead, and only trust the
    // intersection reading once it's stopped growing for a beat.
    const growthTarget = el.closest(".scroll-sections") ?? root;
    const ro = new ResizeObserver(scheduleCheck);
    ro.observe(growthTarget);

    function cleanup() {
      io.disconnect();
      ro.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
    }
    return cleanup;
  }, [visible, containerRef, rootMargin]);

  return <div ref={ref}>{visible ? children : <div className="panel-status">Laen…</div>}</div>;
}
