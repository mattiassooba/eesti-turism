import { useEffect } from "react";

function setMetaTag(attr, value, content) {
  if (content == null) return;
  let el = document.querySelector(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  if (href == null) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Keeps <title>, meta description, canonical link, and Open Graph/Twitter
// tags in sync with the current route. Each /maakond/:slug and
// /en/county/:slug page needs its own distinct values — a canonical link
// that always points at the homepage (index.html's static default) would
// tell Google every region page is a duplicate of "/" and shouldn't be
// indexed on its own, defeating the entire point of giving them real URLs.
export function useDocumentMeta({ title, description, path }) {
  useEffect(() => {
    if (title) {
      document.title = title;
      setMetaTag("property", "og:title", title);
      setMetaTag("name", "twitter:title", title);
    }
    if (description) {
      setMetaTag("name", "description", description);
      setMetaTag("property", "og:description", description);
      setMetaTag("name", "twitter:description", description);
    }
    if (path != null) {
      const url = `https://turismistatistika.ee${path}`;
      setCanonical(url);
      setMetaTag("property", "og:url", url);
    }
  }, [title, description, path]);
}
