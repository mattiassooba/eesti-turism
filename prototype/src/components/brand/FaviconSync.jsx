import { useEffect } from "react";
import { useApp } from "../../state/AppState.jsx";
import { faviconDataUri } from "./Marks.jsx";

export default function FaviconSync() {
  const { brand } = useApp();
  useEffect(() => {
    const link = document.getElementById("proto-favicon");
    if (link) link.href = faviconDataUri(brand);
  }, [brand]);
  return null;
}
