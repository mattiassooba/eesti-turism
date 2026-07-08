import { useEffect } from "react";
import { isAbortError } from "../api/pxweb";

// Wraps the cancelled-flag + AbortController boilerplate that every
// data-fetching effect in this app repeats: cancel the previous run
// (both by aborting its request and by ignoring its result) before
// starting the next, and on unmount.
//
// `asyncEffect(signal, isActive)` does the actual fetch/parse/setState
// work. Pass `signal` to every fetchTableData/fetchLevel/searchTables
// call. Wrap every setState call in `if (isActive()) ...` so a
// superseded run can't write stale state. AbortErrors thrown by an
// aborted fetch are swallowed here — they mean this run was superseded,
// not that something went wrong.
export function useAbortableEffect(asyncEffect, deps) {
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    Promise.resolve(asyncEffect(controller.signal, () => active)).catch((err) => {
      if (isAbortError(err)) return;
      throw err;
    });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
