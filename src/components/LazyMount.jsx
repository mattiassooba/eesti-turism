import { useEffect, useRef, useState } from "react";

// Delays mounting `children` until this wrapper scrolls near the given
// scroll container's viewport. Without this, stacking every section on one
// continuously-scrolling page would fire all of their data fetches at once
// on load, instead of only the sections the user actually scrolls to. Once
// shown, a section stays mounted — scrolling back up shouldn't unmount it
// and lose its fetched data.
//
// rootMargin is deliberately large (several screens' worth): the goal
// isn't just "don't fetch until near the viewport", it's "finish fetching
// and rendering well before the user actually scrolls there". A tight
// margin (e.g. one viewport) means the section's fetch is often still in
// flight when it scrolls into view, so the placeholder-to-content swap
// happens mid-scroll and visibly hitches the page right at that moment.
export default function LazyMount({ children, containerRef, rootMargin = "2400px 0px" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    const root = containerRef.current;
    if (!el || !root) return;

    let intersecting = false;
    const rootScrolls = root.scrollHeight > root.clientHeight;
    const io = new IntersectionObserver(
      (entries) => {
        intersecting = entries[0].isIntersecting;
      },
      { root: rootScrolls ? root : null, rootMargin }
    );
    io.observe(el);

    // A section earlier on the page can still be loading and growing,
    // which shifts this section's position — poll this element's own
    // position rather than reacting to any resize of the shared page
    // container. Watching the shared container instead would mean every
    // section's own placeholder-to-content swap resets every *other*
    // section's settle check too (they all resize the same container),
    // which can cascade into never settling. Committing only once this
    // element's own position has held steady across two checks avoids
    // that entirely. offsetTop (not getBoundingClientRect, which is
    // viewport-relative) so an ongoing scroll doesn't itself look like a
    // layout shift.
    let lastTop = null;
    let stableCount = 0;
    const poll = setInterval(() => {
      const top = el.offsetTop;
      if (intersecting && top === lastTop) {
        stableCount++;
        if (stableCount >= 2) {
          setVisible(true);
          cleanup();
        }
      } else {
        stableCount = 0;
      }
      lastTop = top;
    }, 300);

    function cleanup() {
      io.disconnect();
      clearInterval(poll);
    }
    return cleanup;
  }, [visible, containerRef, rootMargin]);

  return (
    <div ref={ref}>
      {visible ? children : <div className="panel-status lazy-placeholder">Laen…</div>}
    </div>
  );
}
