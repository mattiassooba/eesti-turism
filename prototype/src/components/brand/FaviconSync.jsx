import { useEffect } from "react";
import { faviconDataUri } from "./Marks.jsx";

export default function FaviconSync() {
  useEffect(() => {
    const href = faviconDataUri("a");
    const existing = document.getElementById("proto-favicon") || document.querySelector('link[rel="icon"]');
    if (existing) {
      existing.href = href;
      return;
    }
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = href;
    document.head.appendChild(link);
  }, []);
  return null;
}
